DROP DATABASE IF EXISTS archerphish;
CREATE DATABASE IF NOT EXISTS archerphish;
USE archerphish;

-- ----------------------------
-- Users (platform login)
-- ----------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- Recipients (employees)
-- ----------------------------
CREATE TABLE IF NOT EXISTS recipients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- Campaigns
-- ----------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  difficulty ENUM('low', 'medium', 'high') DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- Phishing Links (1 per employee per campaign)
-- ----------------------------
CREATE TABLE IF NOT EXISTS phishing_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  recipient_id INT NOT NULL,
  tracking_id VARCHAR(48) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY unique_campaign_recipient (campaign_id, recipient_id),

  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES recipients(id)
    ON DELETE CASCADE
);

-- ----------------------------
-- Link Events
-- ----------------------------
CREATE TABLE IF NOT EXISTS link_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phishing_link_id INT NOT NULL,
  event_type ENUM('click') DEFAULT 'click',
  ip_address VARCHAR(255),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (phishing_link_id) REFERENCES phishing_links(id)
    ON DELETE CASCADE
);