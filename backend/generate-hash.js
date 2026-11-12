import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.log('Gunakan: node generate-hash.js "PasswordKamu"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);

console.log("\nPassword Hash:");
console.log(hash);