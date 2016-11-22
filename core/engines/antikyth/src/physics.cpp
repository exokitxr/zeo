

#include "physics.h"
#include "rigidbody.h"
#include "world.h"

void mox::physics::init(Local<Object> exports)
{
  mox::physics::World::Init(exports);
  mox::physics::RigidBody::Init(exports);
}

NAN_METHOD(mox::physics::makeBoxRigidBody)
{
  v8::Local<v8::Object> rigidBodyInstance =
    mox::physics::RigidBody::NewInstance();

  double dx = info[0]->NumberValue();
  double dy = info[1]->NumberValue();
  double dz = info[2]->NumberValue();

  info.GetReturnValue().Set(rigidBodyInstance);
}

NODE_MODULE(mox, mox::physics::init)
