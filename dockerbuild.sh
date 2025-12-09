#/bin/sh
VERSION=`cat package.json | jq -r .version`
export VERSION
tsc
docker compose build 
docker push zdid2/rfxcom2hass:${VERSION}
echo "Docker build finished"
#


