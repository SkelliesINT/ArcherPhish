// Usage: node createAdmin.js <email> <password>
// Example: node createAdmin.js admin@company.com secretpassword

/*
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: node createAdmin.js <email> <password>");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.users.create({
      data: { email, password: hash, role: "admin" },
    });
    console.log(`Admin account created: ${user.email} (id: ${user.id})`);
  } catch (err) {
    if (err.code === "P2002") {
      console.error("An account with that email already exists.");
    } else {
      console.error("Error creating admin:", err.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); */
