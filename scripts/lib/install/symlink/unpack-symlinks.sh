#!/bin/bash

while IFS='' read -r src && read -r dst; do
  ln -s "$src" "$dst";
done </dev/stdin;