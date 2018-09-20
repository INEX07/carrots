const { sep, resolve } = require("path");
const http = require("http");
// const https = require("https");

const express = require("express");

const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const helmet = require("helmet");
const dataDir = resolve(`${process.cwd()}${sep}`);
const templateDir = resolve(`${dataDir}${sep}pages`);

const db = require("./db.js");
const config = require("./config.json");

const root = require("./routes/app.js");
const admin = require("./routes/admin.js");
const account = require("./routes/account.js");
const json = require("./routes/json.js");
const api = require("./routes/api.js");

const app = express();
app.use(express.json());
app.use("/public", express.static(resolve(`${dataDir}${sep}public`)));

app.use(session({
  store: new SQLiteStore({
    dir: "./data"
  }),
  secret: config.secret,
  cookie: { maxAge: 14 * 24 * 60 * 60 * 1000 },
  resave: false,
  saveUninitialized: false
}));

app.use(helmet());
const bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

const requestIp = require("request-ip");
app.use(requestIp.mw());

app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");

// Custom botnet check
app.use(require("./middleware/spamblock.js"));

// Attach Settings to Req
app.use(async (req, res, next) => {
  await db.settings.defer;
  const settings = {};
  for (const [key, value] of db.settings) {
    settings[key] = value;
  }
  req.settings = settings;
  next();
});

// General Logging Task
app.use((req, res, next) => {
  console.log(`${req.clientIp} : ${req.originalUrl} : ${Date.now()}`);
  db.logs.set(db.logs.autonum, {
    time: Date.now(),
    agent: req.headers["user-agent"],
    ip: req.clientIp,
    page: req.originalUrl
  });
  // Set "previous" URL to session (for after logging)
  const notsaved = ["/includes", "/register", "/adduser", "/favicon.ico"];
  if (!notsaved.some(path => req.originalUrl.includes(path))) {
    req.session.back = req.url;
  }
  next();
});

app.use("/", root);
app.use("/", account);
app.use("/json", json);
app.use("/api", api);

const checkAdmin = (req, res, next) => {
  if (!req.session.admin) {
    res.redirect("/");
  }
  next();
};

app.use("/admin", checkAdmin, admin);

// Handle 404
app.use((req, res) => {
  res.render(resolve(`${templateDir}${sep}404.ejs`), { path: req.originalUrl, auth: req.session });
});

// Handle 500
app.use((error, req, res) => {
  res.send("500: Internal Server Error", 500);
});

http.createServer(app).listen(config.port);
