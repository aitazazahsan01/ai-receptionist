import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const faqs = [
  {
    question: "What are your business hours?",
    answer: "We're open Monday through Friday, 9am to 5pm.",
    topic: "hours",
  },
  {
    question: "Where are you located?",
    answer: "We're at 123 Main Street, Suite 200.",
    topic: "location",
  },
  {
    question: "Do you accept walk-ins?",
    answer: "We prefer scheduled appointments, but we'll do our best to fit you in.",
    topic: "booking",
  },
  {
    question: "How do I cancel an appointment?",
    answer: "Call us at least 24 hours in advance and we'll cancel it for you, no fee.",
    topic: "booking",
  },
  {
    question: "Do you offer virtual appointments?",
    answer: "Yes, just let us know when booking and we'll send a video call link.",
    topic: "booking",
  },
];

async function main() {
  for (const faq of faqs) {
    await prisma.faq.create({ data: faq });
  }
  console.log(`Seeded ${faqs.length} FAQs.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
