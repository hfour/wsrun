#!/bin/bash

export PATH=$PWD/node_modules/.bin:$PATH
# RUNCMD=$(jq -r .scripts.$1 package.json)
RUNCMD=$(node -e "console.log(JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts['$1'])")

if [ "xundefined" = "x$RUNCMD" ]
then
  RUNCMD=$1
fi

BASHCMD="$RUNCMD ${@:2}"
echo '$' $BASHCMD
exec bash -c "trap 'kill \$\$' SIGINT ; $BASHCMD"
