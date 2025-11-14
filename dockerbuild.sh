#/bin/sh
VERSION=`cat package.json | jq -r .version`
export VERSION
tsc
docker compose build 
docker push zdid2/rfxcom2hass:${VERSION}
docker tag zdid2/rfxcom2hass:${VERSION} zdid2/rfxcom2hass:latest
docker push zdid2/rfxcom2hass:latest
echo "Docker build finished"
#


