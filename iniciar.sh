#!/usr/bin/env bash
# Carga nvm, activa Node 22, instala dependencias y arranca la app.
# Uso: bash iniciar.sh

for d in "$NVM_DIR" /usr/local/share/nvm "$HOME/.nvm"; do
  if [ -n "$d" ] && [ -s "$d/nvm.sh" ]; then export NVM_DIR="$d"; break; fi
done

if [ -z "$NVM_DIR" ] || [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "nvm no está instalado. Instalándolo..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
fi

. "$NVM_DIR/nvm.sh"
nvm install 22 || exit 1
nvm use 22 || exit 1
echo "Node $(node -v) listo."

npm install || exit 1
npm run dev -- --host
