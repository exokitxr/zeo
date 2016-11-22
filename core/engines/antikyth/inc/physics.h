#pragma once

#include <nan.h>
#include "node.h"

namespace mox {
  namespace physics {
    using v8::FunctionCallbackInfo;
    using v8::Isolate;
    using v8::Local;
    using v8::Object;
    using v8::String;
    using v8::Value;

    void init(Local<Object> exports);

    NAN_METHOD(makeBoxRigidBody);
  }
}
