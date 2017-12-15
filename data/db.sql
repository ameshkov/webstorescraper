CREATE SCHEMA extensions;

CREATE TABLE extensions.extensions (
  id TEXT PRIMARY KEY,
  name TEXT,
  author TEXT,
  description TEXT,
  category TEXT,
  usersCount INTEGER,
  rating NUMERIC,
  ratingsCount INTEGER,
  analyticsId TEXT,
  website TEXT,
  inApp TEXT,
  time_added TIMESTAMP DEFAULT now()
);

CREATE TABLE extensions.extensions_files (
  file_id SERIAL PRIMARY KEY,
  extension_id TEXT,
  file_path TEXT,
  file_content TEXT
);