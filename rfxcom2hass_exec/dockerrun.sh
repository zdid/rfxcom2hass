#/bin/sh
DOCKERDEVICERFX=`ls /dev/serial/by-id/ | grep RFX`
DOCKERDEVICERFX=`readlink /dev/serial/by-id/$DOCKERDEVICERFX`
DOCKERDEVICERFX=/dev/${DOCKERDEVICERFX:6}
export DOCKERDEVICERFX
docker compose up -d
#
