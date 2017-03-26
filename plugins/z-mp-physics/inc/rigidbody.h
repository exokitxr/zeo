#pragma once

#include <nan.h>
#include "pointers.h"

namespace mox {
  namespace physics {

    class RigidBody : public Nan::ObjectWrap {
    public:
      static void Init(v8::Local<v8::Object> namespc);

      static v8::Local<v8::Object> NewInstance();

      btRigidBodyPtr getRigidBody() { return m_rigidBody;  }

    private:
      explicit RigidBody();
      ~RigidBody();

      static const uint32_t OBJECT_TYPE = 1;

      static const uint32_t BOX = 1;
      static const uint32_t PLANE = 2;
      static const uint32_t SPHERE = 3;
      static const uint32_t CONVEX_HULL = 4;
      static const uint32_t TRIANGLE_MESH = 5;
      static const uint32_t COMPOUND = 6;

      uint32_t m_type;
      btCollisionShapePtr m_collisionShape;
      btTriangleMeshPtr m_triangleMesh;
      btCollisionShapes m_collisionShapes;
      btTransform m_transform;
      btDefaultMotionStatePtr m_motionState;
      btRigidBodyPtr m_rigidBody;
      bool m_isDynamic;
      double m_mass;

      static NAN_METHOD(New);
      static NAN_METHOD(make);

      static NAN_METHOD(getMass);
      static NAN_METHOD(getPosition);
      static NAN_METHOD(setPosition);
      static NAN_METHOD(getRotation);
      static NAN_METHOD(setRotation);
      static NAN_METHOD(getLinearVelocity);
      static NAN_METHOD(setLinearVelocity);
      static NAN_METHOD(getAngularVelocity);
      static NAN_METHOD(setAngularVelocity);
      static NAN_METHOD(setLinearFactor);
      static NAN_METHOD(setAngularFactor);
      static NAN_METHOD(activate);
      static NAN_METHOD(deactivate);
      static NAN_METHOD(setActivationState);
      static NAN_METHOD(setIgnoreCollisionCheck);

      static uint32_t getRigidBodyTypeEnum(const v8::Local<v8::Value> &val);

      static Nan::Persistent<v8::Function> constructor;
    };

  }
}
