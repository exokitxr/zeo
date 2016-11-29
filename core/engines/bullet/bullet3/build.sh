mkdir -p bullet-build
pushd bullet-build
cmake .. -G "Unix Makefiles"
make -j4
popd
