# compile.ps1
& ".\emsdk\emsdk_env.ps1"
emcc hello.cpp -s EXPORTED_FUNCTIONS="['_add']" -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap']" -o hello.js
