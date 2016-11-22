#pragma once

#include <nan.h>
#include "pointers.h"

namespace mox {
  namespace physics {

    class World : public Nan::ObjectWrap {
    public:
      static void Init(v8::Local<v8::Object> namespc);

    private:
      explicit World();
      ~World();

      btDefaultCollisionConfigurationPtr m_collisionConfiguration;
      btCollisionDispatcherPtr m_collisionDispatcher;
      btDbvtBroadphasePtr m_dbvtBroadphase;
      btSequentialImpulseConstraintSolverPtr m_sequentialImpulseConstraintSolver;
      btDiscreteDynamicsWorldPtr m_discreteDynamicsWorld;

      static NAN_METHOD(New);

      static NAN_METHOD(addRigidBody);
      static NAN_METHOD(removeRigidBody);
      static NAN_METHOD(stepSimulation);
      static NAN_METHOD(analyse);
      
      static Nan::Persistent<v8::Function> constructor;
    };

  }
}

