-- Schema para tracking de cuentas de Twitter/X
-- Ejecutar en PostgreSQL

-- Crear tabla de cuentas de Twitter tracked
CREATE TABLE IF NOT EXISTS twitter_accounts (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  last_tweet_id TEXT,
  last_check TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(username, guild_id)
);

-- Crear tabla de historial de tweets (opcional, para evitar duplicados)
CREATE TABLE IF NOT EXISTS twitter_history (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES twitter_accounts(id) ON DELETE CASCADE,
  tweet_id TEXT NOT NULL,
  tweet_text TEXT,
  tweet_url TEXT,
  tweeted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, tweet_id)
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_twitter_accounts_username ON twitter_accounts(username);
CREATE INDEX IF NOT EXISTS idx_twitter_accounts_guild ON twitter_accounts(guild_id);
CREATE INDEX IF NOT EXISTS idx_twitter_accounts_active ON twitter_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_twitter_history_account ON twitter_history(account_id);
CREATE INDEX IF NOT EXISTS idx_twitter_history_tweet_id ON twitter_history(tweet_id);
CREATE INDEX IF NOT EXISTS idx_twitter_history_tweeted_at ON twitter_history(tweeted_at);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_twitter_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_twitter_accounts_updated_at
  BEFORE UPDATE ON twitter_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_twitter_accounts_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE twitter_accounts IS 'Cuentas de Twitter/X para monitorear';
COMMENT ON COLUMN twitter_accounts.username IS 'Nombre de usuario sin @';
COMMENT ON COLUMN twitter_accounts.channel_id IS 'ID del canal de Discord para notificaciones';
COMMENT ON COLUMN twitter_accounts.last_tweet_id IS 'ID del último tweet conocido';
COMMENT ON COLUMN twitter_accounts.is_active IS 'Si la cuenta está siendo monitoreada activamente';

COMMENT ON TABLE twitter_history IS 'Historial de tweets enviados';
COMMENT ON COLUMN twitter_history.tweet_id IS 'ID único del tweet';
COMMENT ON COLUMN twitter_history.tweeted_at IS 'Fecha en que se publicó el tweet originalmente';

