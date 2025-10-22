-- PostgreSQL Schema for Monad NFT Trading Bot
-- Execute this script in Railway PostgreSQL console

-- Create NFT Projects table
CREATE TABLE IF NOT EXISTS nft_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  contract_address TEXT NOT NULL,
  marketplace TEXT DEFAULT 'magic-eden',
  status TEXT DEFAULT 'active',
  last_floor_price DECIMAL,
  last_volume DECIMAL,
  last_sales_count INTEGER,
  last_listings_count INTEGER,
  last_avg_sale_price DECIMAL,
  last_update TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create User Alerts table
CREATE TABLE IF NOT EXISTS user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL,
  project_id UUID REFERENCES nft_projects(id) ON DELETE CASCADE,
  alert_types TEXT[] DEFAULT '{}',
  floor_threshold DECIMAL DEFAULT 5.0,
  volume_threshold DECIMAL DEFAULT 10.0,
  sales_threshold INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create Price History table
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES nft_projects(id) ON DELETE CASCADE,
  floor_price DECIMAL,
  volume_24h DECIMAL,
  sales_count INTEGER,
  listings_count INTEGER,
  avg_sale_price DECIMAL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_nft_projects_status ON nft_projects(status);
CREATE INDEX IF NOT EXISTS idx_nft_projects_name ON nft_projects(name);
CREATE INDEX IF NOT EXISTS idx_user_alerts_discord_id ON user_alerts(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_user_alerts_project_id ON user_alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_user_alerts_active ON user_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_price_history_project_id ON price_history(project_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_nft_projects_updated_at 
  BEFORE UPDATE ON nft_projects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_alerts_updated_at 
  BEFORE UPDATE ON user_alerts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data (optional)
INSERT INTO nft_projects (name, contract_address, marketplace, status) VALUES
  ('Monad Punks', '0x1234567890abcdef1234567890abcdef12345678', 'magic-eden', 'active'),
  ('Monad Apes', '0xabcdef1234567890abcdef1234567890abcdef12', 'magic-eden', 'active')
ON CONFLICT (name) DO NOTHING;

-- Create view for project statistics
CREATE OR REPLACE VIEW project_stats AS
SELECT 
  p.id,
  p.name,
  p.contract_address,
  p.marketplace,
  p.status,
  p.last_floor_price,
  p.last_volume,
  p.last_sales_count,
  p.last_listings_count,
  p.last_update,
  COUNT(DISTINCT ua.id) as alert_count,
  COUNT(DISTINCT ph.id) as history_count
FROM nft_projects p
LEFT JOIN user_alerts ua ON p.id = ua.project_id AND ua.is_active = true
LEFT JOIN price_history ph ON p.id = ph.project_id
GROUP BY p.id, p.name, p.contract_address, p.marketplace, p.status, 
         p.last_floor_price, p.last_volume, p.last_sales_count, 
         p.last_listings_count, p.last_update;
