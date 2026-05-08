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
