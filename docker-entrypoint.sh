#!/bin/sh

set -e

echo "Starting complex-review container..."
echo "NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL:-not set}"

# Check if environment variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "Warning: Supabase environment variables not set"
fi

# Create the config script
CONFIG_SCRIPT="window.__ENV__ = { NEXT_PUBLIC_SUPABASE_URL: '${NEXT_PUBLIC_SUPABASE_URL}', NEXT_PUBLIC_SUPABASE_ANON_KEY: '${NEXT_PUBLIC_SUPABASE_ANON_KEY}' };"

# Find all HTML files and inject config before the first script tag
find /app/.next -name "*.html" 2>/dev/null | while read -r file; do
  if grep -q "<head>" "$file"; then
    sed -i "s|<head>|<head><script>$CONFIG_SCRIPT</script>|g" "$file"
  fi
done

echo "Injected runtime configuration"

# Use PORT from environment, default to 8080  
PORT=${PORT:-8080}
export PORT
export HOSTNAME="0.0.0.0"

echo "Starting Next.js on port $PORT..."

# Start Next.js server
exec node server.js
