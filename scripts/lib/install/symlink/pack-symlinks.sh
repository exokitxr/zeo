#!/bin/bash

for f in $(find . -type l);
do
  src="$(realpath -s $f)";
  dst="$(realpath -P $src)";
  echo "$src";
  echo "$dst";
  rm -Rf "$src";
done;