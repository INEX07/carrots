const Enmap = require("enmap");
const bcrypt = require("bcrypt");
const marked = require("marked");

exports.users = new Enmap({ name: "users" });
exports.articles = new Enmap({ name: "articles" });
exports.comments = new Enmap({ name: "comments" });
exports.logs = new Enmap({ name: "logs" });
exports.settings = new Enmap({ name: "settings" });

exports.login = (username, password) => {
  const user = this.users.get(username);
  if (!user) return new Promise(resp => resp(false));
  if (!password) return new Promise(resp => resp(false));
  return bcrypt.compare(password, user.password);
};

exports.newuser = (username, name, plainpw, admin = false) => {
  if (this.users.has(username)) throw Error(`User ${username} already exists!`);
  const score = scorePassword(plainpw);
  if (score < 30) throw new Error(`Your password is too weak, and cannot be used.`);
  bcrypt.hash(plainpw, 10, (err, password) => {
    if (err) throw err;
    this.users.set(username, {
      username, name, password, admin, avatar: null, created: Date.now()
    });
  });
};

exports.getCleanUser = (username) => {
  if (!this.users.has(username)) return null;
  const user = this.users.get(username);
  delete user.password;
  return user;
};

exports.getArticle = (id) => {
  if (!this.articles.has(id)) return null;
  const article = this.articles.get(id);
  const comments = this.getComments(id);
  article.account = this.getCleanUser(article.user);
  article.rendered = marked(article.content);
  article.comments = comments;
  return article;
};

exports.getArticles = (publishedOnly = false) => {
  let articles;
  if (publishedOnly) {
    articles = this.articles.filter(a => !!a.title && a.published);
  } else {
    articles = this.articles.filter(a => !!a.title);
  }
  const parsed = articles.keyArray().map(this.getArticle);
  return parsed;
};

exports.getComment = (id) => {
  if (!this.comments.has(id)) return null;
  const comment = this.comments.get(id);
  comment.account = this.getCleanUser(comment.user);
  comment.rendered = marked(comment.content);
  return comment;
};

exports.getComments = (article) => {
  const comments = this.comments.filter(comment => !!comment.id && comment.parent === article);
  const parsed = comments.keyArray().map(this.getComment);
  return parsed;
};

exports.getUsers = () => this.users.map(user => this.getCleanUser(user.username));

// https://stackoverflow.com/questions/948172/password-strength-meter
function scorePassword(pass) {
  let score = 0;
  if (!pass) {
    return score;
  }

  // award every unique letter until 5 repetitions
  const letters = {};
  for (let i = 0; i < pass.length; i++) {
    letters[pass[i]] = (letters[pass[i]] || 0) + 1;
    score += 5.0 / letters[pass[i]];
  }

  // bonus points for mixing it up
  const variations = {
    digits: /\d/.test(pass),
    lower: /[a-z]/.test(pass),
    upper: /[A-Z]/.test(pass),
    nonWords: /\W/.test(pass)
  };

  let variationCount = 0;
  for (var check in variations) {
    variationCount += (variations[check] == true) ? 1 : 0;
  }
  score += (variationCount - 1) * 10;

  return parseInt(score);
}
