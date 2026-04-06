#!/bin/sh
# Replace backend URL in nginx config at runtime
# Usage: docker run -e BACKEND_URL=http://finwise-backend:4000 ...

if [ -n "$BACKEND_URL" ]; then
  sed -i "s|proxy_pass http://finwise-backend:4000|proxy_pass ${BACKEND_URL}|g" /etc/nginx/conf.d/default.conf
  echo "Nginx: backend set to ${BACKEND_URL}"
fi

exec nginx -g 'daemon off;'
