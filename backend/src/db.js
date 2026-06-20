const mysql = require('mysql2/promise');

/** Pool de conexões MariaDB/MySQL compartilhado por toda a aplicação, configurado em UTC e utf8mb4. */
const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             parseInt(process.env.DB_PORT || '3306'),
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'crmbr4',
  waitForConnections: true,
  // Dimensionado para concorrência. Limite total no MariaDB = connectionLimit ×
  // nº de réplicas (web + worker) — ajuste DB_POOL conforme max_connections.
  connectionLimit:  parseInt(process.env.DB_POOL || '25', 10),
  // Fila finita: sob saturação, rejeita rápido em vez de enfileirar sem teto
  // (evita "travamento" silencioso e timeouts em cascata).
  queueLimit:       parseInt(process.env.DB_QUEUE || '200', 10),
  enableKeepAlive:  true,
  keepAliveInitialDelay: 10000,
  connectTimeout:   10000,
  timezone:         'Z',        // Store/return UTC
  dateStrings:      true,       // Return DATE/DATETIME as strings
  charset:          'utf8mb4',
});

module.exports = pool;
