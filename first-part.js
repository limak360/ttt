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
          user_online: null,
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

var promiseUserId = null;

function login(request, response) {
  // TODO: logowanie
  var user_name = request.body.user_name;
  var user_password = request.body.user_password;
  if (user_name && user_password) {
    User.count({
      where: { user_name: user_name, user_password: user_password },
    }).then((count) => {
      if (count != 0) {
        request.session.loggedin = true;

        async function setUserId() {
          return await UserIdPromise(
            (user_nam = user_name),
            (user_password = user_password)
          );
        }
        request.session.user_id = setUserId();
        promiseUserId = setUserId();

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

async function UserIdPromise(user_name, user_password) {
  return User.findAll({
    where: {
      user_name: user_name,
      user_password: user_password,
    },
  }).then((data) => {
    return data[0].user_id;
  });
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
  User.findAll().then((users) => response.json(users)); // pokazuje zarejestrowanych nie zalogowanych
  //   response.send({ data: [] });
}

app.get("/api/test-get", testGet);

app.post("/api/register/", [register]);

app.post("/api/login/", [login]);

app.get("/api/login-test/", [checkSessions, loginTest]);

app.get("/api/logout/", [checkSessions, logout]);

app.get("/api/users/", [checkSessions, getUsers]);

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
    async () => {
      if (!(await promiseUserId)) {
        // tylko raz mozna odczytac promise
        socket.destroy();
        return;
      }
    };
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

  const setConnected = async () => {
    const id = await promiseUserId; // to nie zadziala  tylko raz mozna odczytac promise
    socket.destroy();
    onlineUsers[id] = ws;
    const user = User.findByPk(id).then((data) => {
      console.log("OBJEKT on connection" + JSON.stringify(data));
    });

    user.user_online = true;
    User.update(user, {
      where: { id: id },
    });
  };
  setConnected();

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
    const setDisconnected = async () => {
      const id = await promiseUserId; // to nie zadziala  tylko raz mozna odczytac promise
      socket.destroy();
      delete onlineUsers[id];
      const user = User.findByPk(id).then((data) => {
        console.log("OBJEKT on disconnection" + JSON.stringify(data));
      });

      user.user_online = false;
      User.update(user, {
        where: { id: id },
      });
    };
    setDisconnected();
  });
});
