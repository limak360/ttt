var express = require("express");
const Sequelize = require("sequelize");
const cors = require("cors");
var session = require("express-session");

var app = express();
var PORT = process.env.PORT || 8080;
var server = app.listen(PORT, () => console.log(`Listening on ${PORT}`));

const sequelize = new Sequelize("database", "root", "root", {
  dialect: "sqlite",
  storage: "orm-db.sqlite",
});

const sessionParser = session({
  saveUninitialized: false,
  secret: "$secret",
  resave: false,
});

app.use(express.json());
app.use(cors());
app.use(sessionParser);

// Stworzenie modelu - tabeli User
const User = sequelize.define("user", {
  user_id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_name: Sequelize.STRING,
  user_password: Sequelize.STRING,
  user_online: Sequelize.BOOLEAN,
});

const Message = sequelize.define("message", {
  message_id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  message_from_user_id: Sequelize.STRING,
  message_to_user_id: Sequelize.STRING,
  message_text: Sequelize.STRING,
});

// synchroniznacja bazy danych - np. tworzenie tabel
sequelize.sync({ force: true }).then(() => {
  console.log(`Database & tables created!`);
});

function testGet(request, response) {
  response.send("testGet working");
}

function register(request, response) {
  console.log(request.body);
  var user_name = request.body.user_name;
  var user_password = request.body.user_password;
  if (user_name && user_password) {
    User.count({ where: { user_name: user_name } }).then((count) => {
      if (count != 0) {
        response.send({ register: false });
      } else {
        User.create({
          user_name: user_name,
          user_password: user_password,
          user_online: false,
        })
          .then(() => response.send({ register: true }))
          .catch(function (err) {
            response.send({ register: true });
          });
      }
    });
  } else {
    response.send({ register: false });
  }
}

function login(request, response) {
  // TODO: logowanie
  var user_name = request.body.user_name;
  var user_password = request.body.user_password;
  if (user_name && user_password) {
    User.findAll({
      where: { user_name: user_name, user_password: user_password },
    }).then((users) => {
      if (users.length > 0) {
        request.session.loggedin = true;
        request.session.user_id = users[0].dataValues.user_id;
        response.send({ loggedin: true });
      } else {
        console.log("user doesnt exist");
        response.send({ loggedin: false });
      }
    });
  } else {
    console.log("Incorrect credentials");
    response.send({ loggedin: false });
  }
}

function loginTest(request, response) {
  response.send({ loggedin: true });
}

function logout(request, response) {
  // TODO: niszczenie sesji
  if ((request.session.loggedin = true)) {
    request.session.destroy();
    console.log("user logged out");
    response.send({ loggedout: true });
  } else {
    console.log("user not logged in");
    response.send({ loggedout: false });
  }
}

function checkSessions(request, response, next) {
  if (request.session.loggedin) {
    next();
  } else {
    response.send({ loggedin: false });
  }
}

function getUsers(request, response) {
  //TODO: wysłanie listy użytkowników klientowi
  User.findAll().then((users) => response.json(users));
}

function sendMessages(request, response) {
  var message_text = request.body.message_text;
  var to = request.body.message_to_user_id;
  console.log(
    `Received message => ${message_text} from ${request.session.user_id} to ${to}`
  );

  User.findAll({ where: { user_id: to } }).then((users) => {
    if (users.length >= 1) {
      var mes = {
        message_from_user_id: 0, //TODO
        message_to_user_id: users[0].user_id,
        message_text: "", //TODO
      };
      var user = users[0];
      Message.create(mes)
        .then((mes) => {
          if (user.user_id in onlineUsers) {
            // Wysyłanie wiadomości do użytkownika
          }
          if (mes.message_from_user_id !== mes.message_to_user_id) {
            if (mes.message_from_user_id in onlineUsers) {
              // Wysyłanie wiadomości do samego siebie jeżeli użytkownik nie wysyła wiadomości do siebie.
            }
          }

          response.send({ sending: true });
        })
        .catch(function (err) {
          console.log(err);
          response.send({ error: err });
        });
    } else {
      response.send({ error: "User not exists" });
    }
  });
}

function getMessages(request, response) {

  // register
  // register
}

app.get("/api/test-get", testGet);

app.post("/api/register/", [register]);

app.post("/api/login/", [login]);

app.get("/api/login-test/", [checkSessions, loginTest]);

app.get("/api/logout/", [checkSessions, logout]);

app.get("/api/users/", [checkSessions, getUsers]);

app.get("/api/messages/:id", [checkSessions, getMessages]);

app.post("/api/messages/", [checkSessions, sendMessages]);

//WS

const WebSocket = require("ws");

//dołączenie folderu public ze statycznymi plikami aplikacji klienckiej
app.use(express.static(__dirname + "/second-part/"));

const wss = new WebSocket.Server({
  noServer: true,
});

server.on("upgrade", function (request, socket, head) {
  // Sprawdzenie czy dla danego połączenia istnieje sesja
  sessionParser(request, {}, () => {
    if (!request.session.user_id) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, function (ws) {
      wss.emit("connection", ws, request);
    });
  });
});

let onlineUsers = {};

wss.on("connection", function (ws, request) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ status: 2 }));
    }
  });
  onlineUsers[request.session.user_id] = ws;
  var keys = Object.keys(onlineUsers);

  User.findAll().then((users) => {
    for (user of users) {
      //jakis blad logiczny  dla kazdego robi nie dla wybranego
      if (!(keys[user.dataValues.user_id - 1] === "undefined")) {
        User.update(
          { user_online: true },
          { where: { user_id: user.dataValues.user_id } }
        ).then(console.log("Updated"));
      }
    }
  });

  ws.on("message", function (message) {
    console.log(message);
    // parsowanie wiadomosci z JSONa na obiekt
    try {
      var data = JSON.parse(message);
    } catch (error) {
      return;
    }
  });

  ws.on("close", () => {
    delete onlineUsers[request.session.user_id];
    var keys = Object.keys(onlineUsers);
    User.findAll().then((users) => {
      for (user of users) {
        if (!(keys[user.dataValues.user_id - 1] === "undefined")) {
          User.update(
            { user_online: false },
            { where: { user_id: user.dataValues.user_id } }
          ).then(console.log("Updated"));
        }
      }
    });
  });
});
