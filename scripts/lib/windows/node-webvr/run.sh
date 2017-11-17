#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

$DIR/node_modules/.bin/electron $DIR/node_modules/node-webvr "$1"
