const { sep, resolve } = require("path");

const dataDir = resolve(`${process.cwd()}${sep}`);
const templateDir = resolve(`${dataDir}${sep}pages`);

const express = require("express");
const db = require("../db.js");

const app = express.Router();
app.use(express.json());

// Login/Logout Features

app.get(["/user/:id", "/user"], (req, res) => {
  const user = db.users.get(req.params.id || req.session.username);
  if (!user) return res.redirect("/login");
  const comments = db.comments.filter(comment => comment.user === user.username);
  const articles = db.articles.filter(article => article.user === user.username);
  return res.render(resolve(`${templateDir}${sep}user.ejs`), { path: req.path, settings: req.settings, user, articles, comments, auth: req.session });
});

app.get("/register", (req, res) => {
  res.render(resolve(`${templateDir}${sep}register.ejs`), { path: req.path, settings: req.settings, auth: req.session });
});

app.post("/register", (req, res) => {
  db.newuser(req.body.username, req.body.name, req.body.password, req.body.admin === "on");
  res.redirect(req.session.back || "/");
});

app.get("/login", (req, res) => {
  res.render(resolve(`${templateDir}${sep}login.ejs`), { path: req.path, settings: req.settings, auth: req.session });
});

app.post("/login", async (req, res) => {
  if (!req.body.username || !req.body.password) res.status(400).send("Missing Username or Password");
  const success = await db.login(req.body.username, req.body.password);
  if (success) {
    const user = db.users.get(req.body.username);
    req.session.logged = true;
    req.session.username = req.body.username;
    req.session.admin = user.admin;
    req.session.avatar = user.avatar;
    req.session.name = user.name;
    req.session.save();
    console.log(`User authenticated: ${user.username}`);
    res.redirect(req.session.back || "/");
  } else {
    console.log("Authentication Failed");
    res.status(403).send("Nope. Not allowed, mate.");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.log(`Error destroying session: ${err}`);
    res.redirect("/");
  });
});

app.get("/me", (req, res) => {
  if (!req.session.logged) return res.redirect("/login");
  const user = db.users.get(req.session.username);
  const comments = db.comments.filter(comment => comment.user === user.username);
  const articles = db.articles.filter(article => article.user === user.username);
  return res.render(resolve(`${templateDir}${sep}me.ejs`), { path: req.path, settings: req.settings, user, comments, articles, auth: req.session });
});

app.post("/me", async (req, res) => {
  if (!req.session.logged) res.redirect("/login");
  if (!db.users.has(req.session.username)) throw new Error("Shroedinger's User. You both exist and don't exist at the same time. How curious!");
  if (!req.session.admin && req.body.admin === "on") {
    throw new Error("Oh yeah, sure, I'm going to let a non-admin make themselves admin. SURE, BUDDY, TAKE CONTROL OF THIS BLOG! /s");
  }
  await db.edituser({
    ...req.body,
    username: req.session.username,
    admin: req.body.admin === "on",
  });
  req.session.name = req.body.name;
  res.redirect(req.session.back || "/");
});

// Initial Install Features

app.get("/install", (req, res) => {
  if (db.settings.count > 0 || db.users.count > 0) {
    return res.status(403).send("ALREADY INITIALIZED, GO AWAY PUNY HUMAN!");
  }
  return res.render(resolve(`${templateDir}${sep}install.ejs`), { path: req.path, settings: req.settings, auth: req.session });
});

app.post("/install", (req, res) => {
  if (db.settings.count > 0 || db.users.count > 0) {
    return res.status(403).send("ALREADY INITIALIZED, GO AWAY PUNY HUMAN!");
  }
  const checks = ["username", "password", "title", "description", "author"];
  if (checks.some(field => req.body[field].length < 3)) {
    return res.status(400).send("Field information missing to create the site.");
  }
  checks.slice(2).forEach(field => {
    db.settings.set(field, req.body[field]);
  });
  db.settings.set("init", true);
  db.settings.set("commentsEnabled", req.body.enableComments === "on");
  db.settings.set("registrationEnabled", req.body.enableRegistration === "on");

  db.newuser(req.body.username, req.body.name, req.body.password, true);

  if (req.body.examples) {
    const one = db.articles.autonum;
    db.articles.set(one, {
      id: one,
      content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam imperdiet iaculis nulla quis malesuada. Phasellus feugiat sed ipsum vel fermentum. Nullam efficitur volutpat lectus. Vestibulum elementum porta sem nec luctus. Integer mauris felis, placerat a volutpat ut, sollicitudin quis est. Nulla a elit placerat dolor pulvinar euismod sit amet laoreet mauris. Fusce ac odio vitae diam ultricies accumsan pulvinar ornare ex. Nunc enim dui, pellentesque vel nibh ut, lacinia eleifend magna. Aenean ac orci est. Donec aliquam urna tellus, et mollis velit fermentum vitae. Aliquam porttitor nisl ut lacus fringilla dictum. Pellentesque blandit metus risus, vitae commodo magna sollicitudin at.",
      title: "This is a test post because who wants an empty page?",
      published: true,
      date: Date.now(),
      user: req.body.username,
    });
    const cmt = db.comments.autonum;
    db.comments.set(cmt, {
      id: cmt,
      parent: one,
      content: "FUN FACT! : 'Lorem ipsum dolor sit amet' translates to 'Lorem ipsum carrots' on Google Translate!",
      user: req.body.username,
      date: Date.now(),
    });
  }
  return res.redirect("/");
});

module.exports = app;
