const bcrypt = require('bcrypt');

const password = 'password123';  // <- this will be the password you type on login

bcrypt.hash(password, 10).then(hash => {
  console.log('Hashed password:', hash);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});