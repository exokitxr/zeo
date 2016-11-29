#pragma once

#include <nan.h>
#include "pointers.h"

namespace mox {
  namespace physics {

    class Constraint : public Nan::ObjectWrap {
    public:
      static void Init(v8::Local<v8::Object> namespc);

      static v8::Local<v8::Object> NewInstance();

      btTypedConstraintPtr getConstraint() { return m_constraint;  }

    private:
      explicit Constraint();
      ~Constraint();

      static const uint32_t OBJECT_TYPE = 2;

      btTypedConstraintPtr m_constraint;

      static NAN_METHOD(New);
      static NAN_METHOD(make);

      static Nan::Persistent<v8::Function> constructor;
    };

  }
}
