var express = require("express");
const cors = require("cors");
var session = require("express-session");
var app = express();
var PORT = process.env.PORT || 8080;

var server = app.listen(PORT, () => console.log(`Listening on ${PORT}`));

app.use(cors());

const sessionParser = session({
  saveUninitialized: false,
  secret: "$secret",
  resave: false,
});
app.use(sessionParser);

function checkSessions(request, response, next) {
  console.log("checkSessions");
  if (request.session.loggedin) {
    next();
  } else {
    response.send({ loggedin: false });
  }
}

function login(request, response) {
  console.log("login");
  if (!request.session.loggedin) {
    request.session.loggedin = true;
    request.session.user_name = request.params.user_name;
  }
  response.send({ loggedin: true, user_name: request.session.user_name });
}

function logout(request, response) {
  console.log("logout");
  request.session.destroy();
  response.send({ loggedin: false });
}

function loginTest(request, response) {
  console.log("loginTest");
  response.send({ loggedin: true, user_name: request.session.user_name });
}

app.get("/login/:user_name", [login]);
app.get("/logout/", [checkSessions, logout]);
app.get("/test/", [checkSessions, loginTest]);
