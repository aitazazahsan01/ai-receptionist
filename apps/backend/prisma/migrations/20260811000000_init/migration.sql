-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('booked', 'faq_answered', 'transferred', 'abandoned', 'no_action');

-- CreateEnum
CREATE TYPE "Speaker" AS ENUM ('caller', 'agent');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('confirmed', 'cancelled');

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "twilio_call_sid" TEXT NOT NULL,
    "caller_number" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "outcome" "CallOutcome",
    "transferred_to" TEXT,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_entries" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "speaker" "Speaker" NOT NULL,
    "text" TEXT NOT NULL,
    "spoken_at" TIMESTAMP(3) NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "transcript_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "call_id" TEXT,
    "google_event_id" TEXT,
    "caller_name" TEXT,
    "caller_phone" TEXT,
