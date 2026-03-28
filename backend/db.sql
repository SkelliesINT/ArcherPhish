CREATE DATABASE IF NOT EXISTS archerphish;
USE archerphish;

-- ----------------------------
-- Users (platform login)
-- ----------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20),
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

-- ----------------------------
-- Roles Tables
-- ----------------------------

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,

  PRIMARY KEY (role_id, permission_id),

  CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES roles(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX fk_role_permissions_permission (permission_id)
) ENGINE=InnoDB;

CREATE TABLE user_roles (
  user_id INT NOT NULL,
  role_id INT NOT NULL,

  PRIMARY KEY (user_id, role_id),

  CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_user_roles_role
    FOREIGN KEY (role_id) REFERENCES roles(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX fk_user_roles_role (role_id)
) ENGINE=InnoDB;

------------------------------
-- Insert Roles/Permissions --
------------------------------

INSERT INTO roles (name) VALUES
('SuperAdmin'),
('Admin'),
('CampaignManager'),
('DataAnalyst'),
('Auditor');

INSERT INTO permissions (name) VALUES
('manage_users'),
('assign_roles'),
('create_campaign'),
('delete_campaign'),
('manage_recipients'),
('view_all_analytics'),
('view_campaigns'),
('export_reports'),
('delete_link_events'),
('send_campaigns'),
('view_recipients'),
('view_at_risk_analytics'),
('view_department_analytics'),
('modify_system_settings');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'SuperAdmin';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'manage_users',
  'create_campaign',
  'delete_campaign',
  'manage_recipients',
  'view_all_analytics',
  'view_recipients',
  'send_campaigns',
  'view_at_risk_analytics', 
  'view_department_analytics',
  'export_reports'
)
WHERE r.name = 'Admin';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'create_campaign',
  'manage_recipients',
  'view_recipients',
  'view_campaigns'
)
WHERE r.name = 'CampaignManager';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'view_all_analytics',
  'view_campaigns',
  'view_recipients',
  'view_at_risk_analytics', 
  'view_department_analytics',
  'export_reports'
)
WHERE r.name = 'DataAnalyst';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'view_all_analytics',
  'view_at_risk_analytics', 
  'export_reports',
  'view_department_analytics'
)
WHERE r.name = 'Auditor';

----------------------------------
-- To Make Yourself Super Admin --
----------------------------------

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'your@email.com'
AND r.name = 'SuperAdmin';
