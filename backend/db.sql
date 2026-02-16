CREATE DATABASE IF NOT EXISTS archerphish;

USE archerphish;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS targets (
  --receipients_identity
  id INT AUTO_INCREMENT PRIMARY KEY,
  firstName VARCHAR(255),
  lastName VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,

 --job_related_identifiers
  position_title VARCHAR(255),
  department VARCHAR(255),
  employment_status VARCHAR(255),
  started_employment_date DATE,
  manager_name VARCHAR(255),

  --access_and_privileges
  access_level VARCHAR(255),
  last_login TIMESTAMP,
  account_status VARCHAR(255),

  --personal_and_behavioral_indicators
  primary_tools_used VARCHAR(255),
  last_training_completed VARCHAR(255),
  
  --work_related_indicators
  recent_tasks_or_projects VARCHAR(255)

);