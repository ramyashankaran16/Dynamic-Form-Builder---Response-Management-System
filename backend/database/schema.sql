-- =====================================================================
-- Dynamic Form Builder & Response Management System
-- MySQL 8.0 schema (equivalent to Alembic revision 0001)
--
-- Preferred setup: `alembic upgrade head` + `python -m app.db.init_db`.
-- Use this file for MySQL Workbench / manual setup / ER diagram reverse engineering.
-- NOTE: if you create the schema with this file, run `alembic stamp head`
--       before using Alembic migrations.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS form_builder
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE form_builder;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS activity_logs, response_details, form_responses, field_options, form_fields, forms, users, roles;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE roles (
    id INTEGER NOT NULL AUTO_INCREMENT, 
    name VARCHAR(50) NOT NULL, 
    description VARCHAR(255), 
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    CONSTRAINT pk_roles PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE UNIQUE INDEX ix_roles_name ON roles (name);

CREATE TABLE users (
    id INTEGER NOT NULL AUTO_INCREMENT, 
    full_name VARCHAR(150) NOT NULL, 
    email VARCHAR(255) NOT NULL, 
    hashed_password VARCHAR(255) NOT NULL, 
    role_id INTEGER NOT NULL, 
    is_active BOOL NOT NULL DEFAULT 1, 
    last_login_at DATETIME, 
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, 
    CONSTRAINT pk_users PRIMARY KEY (id), 
    CONSTRAINT fk_users_role_id_roles FOREIGN KEY(role_id) REFERENCES roles (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE INDEX ix_users_role_id ON users (role_id);

CREATE TABLE activity_logs (
    id INTEGER NOT NULL AUTO_INCREMENT, 
    user_id INTEGER, 
    action VARCHAR(50) NOT NULL, 
    entity_type VARCHAR(50), 
    entity_id INTEGER, 
    description VARCHAR(500), 
    old_values JSON, 
    new_values JSON, 
    ip_address VARCHAR(45), 
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    CONSTRAINT pk_activity_logs PRIMARY KEY (id), 
    CONSTRAINT fk_activity_logs_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_activity_logs_action ON activity_logs (action);

CREATE INDEX ix_activity_logs_created_at ON activity_logs (created_at);

CREATE INDEX ix_activity_logs_entity_type_entity_id ON activity_logs (entity_type, entity_id);

CREATE INDEX ix_activity_logs_user_id ON activity_logs (user_id);

CREATE TABLE forms (
    id INTEGER NOT NULL AUTO_INCREMENT, 
    title VARCHAR(255) NOT NULL, 
    description TEXT, 
    slug VARCHAR(64) NOT NULL, 
    owner_id INTEGER NOT NULL, 
    is_active BOOL NOT NULL DEFAULT 1, 
    is_public BOOL NOT NULL DEFAULT 0, 
    allow_response_edit BOOL NOT NULL DEFAULT 0, 
    allow_multiple_submissions BOOL NOT NULL DEFAULT 1, 
    submit_message VARCHAR(500), 
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, 
    CONSTRAINT pk_forms PRIMARY KEY (id), 
    CONSTRAINT fk_forms_owner_id_users FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_forms_owner_id ON forms (owner_id);

CREATE UNIQUE INDEX ix_forms_slug ON forms (slug);

CREATE TABLE form_fields (
    id INTEGER NOT NULL AUTO_INCREMENT, 
    form_id INTEGER NOT NULL, 
    field_key VARCHAR(100) NOT NULL, 
    label VARCHAR(255) NOT NULL, 
    field_type VARCHAR(20) NOT NULL, 
    placeholder VARCHAR(255), 
    help_text VARCHAR(500), 
    is_required BOOL NOT NULL DEFAULT 0, 
    order_index INTEGER NOT NULL DEFAULT 0, 
    config JSON, 
    visibility_rules JSON, 
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, 
    CONSTRAINT pk_form_fields PRIMARY KEY (id), 
    CONSTRAINT fk_form_fields_form_id_forms FOREIGN KEY(form_id) REFERENCES forms (id) ON DELETE CASCADE, 
    CONSTRAINT uq_form_fields_form_id_field_key UNIQUE (form_id, field_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_form_fields_form_id ON form_fields (form_id);

CREATE TABLE form_responses (
    id INTEGER NOT NULL AUTO_INCREMENT, 
    form_id INTEGER NOT NULL, 
    submitted_by INTEGER, 
    updated_by INTEGER, 
    ip_address VARCHAR(45), 
    user_agent VARCHAR(500), 
    version INTEGER NOT NULL DEFAULT 1, 
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, 
    CONSTRAINT pk_form_responses PRIMARY KEY (id), 
    CONSTRAINT fk_form_responses_form_id_forms FOREIGN KEY(form_id) REFERENCES forms (id) ON DELETE CASCADE, 
    CONSTRAINT fk_form_responses_submitted_by_users FOREIGN KEY(submitted_by) REFERENCES users (id) ON DELETE SET NULL, 
    CONSTRAINT fk_form_responses_updated_by_users FOREIGN KEY(updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_form_responses_form_id_created_at ON form_responses (form_id, created_at);

CREATE INDEX ix_form_responses_submitted_by ON form_responses (submitted_by);

CREATE TABLE field_options (
    id INTEGER NOT NULL AUTO_INCREMENT, 
    field_id INTEGER NOT NULL, 
    label VARCHAR(255) NOT NULL, 
    value VARCHAR(255) NOT NULL, 
    order_index INTEGER NOT NULL DEFAULT 0, 
    CONSTRAINT pk_field_options PRIMARY KEY (id), 
    CONSTRAINT fk_field_options_field_id_form_fields FOREIGN KEY(field_id) REFERENCES form_fields (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_field_options_field_id ON field_options (field_id);

CREATE TABLE response_details (
    id INTEGER NOT NULL AUTO_INCREMENT, 
    response_id INTEGER NOT NULL, 
    field_id INTEGER, 
    field_key VARCHAR(100) NOT NULL, 
    field_label VARCHAR(255) NOT NULL, 
    field_type VARCHAR(20) NOT NULL, 
    value TEXT, 
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, 
    CONSTRAINT pk_response_details PRIMARY KEY (id), 
    CONSTRAINT fk_response_details_field_id_form_fields FOREIGN KEY(field_id) REFERENCES form_fields (id) ON DELETE SET NULL, 
    CONSTRAINT fk_response_details_response_id_form_responses FOREIGN KEY(response_id) REFERENCES form_responses (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_response_details_field_id ON response_details (field_id);

CREATE INDEX ix_response_details_response_id_field_key ON response_details (response_id, field_key);

-- ---------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------
INSERT INTO roles (name, description) VALUES
  ('Admin', 'Full access: all forms, responses, users, analytics and logs'),
  ('User',  'Create and manage own forms and their responses');

-- Default admin  ->  admin@formbuilder.com / Admin@123  (CHANGE AFTER FIRST LOGIN)
INSERT INTO users (full_name, email, hashed_password, role_id, is_active)
SELECT 'System Administrator', 'admin@formbuilder.com', '$2b$12$IdqoYRcKBYiVA1JUtLN6m./J2NgsF/9LfXYbqjBB6MLjslT8PZdrO', id, 1
FROM roles WHERE name = 'Admin';

