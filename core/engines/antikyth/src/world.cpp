
#include "helper.h"
#include "pointers.h"
#include "btBulletDynamicsCommon.h"
#include "world.h"
#include "rigidbody.h"

Nan::Persistent<v8::Function> mox::physics::World::constructor;

mox::physics::World::World()
{
  m_collisionConfiguration = std::make_shared<btDefaultCollisionConfiguration>();

  m_collisionDispatcher = std::make_shared<btCollisionDispatcher>(m_collisionConfiguration.get());

  m_dbvtBroadphase = std::make_shared<btDbvtBroadphase>();

  m_sequentialImpulseConstraintSolver =
    std::make_shared<btSequentialImpulseConstraintSolver>();

  m_discreteDynamicsWorld = std::make_shared<btDiscreteDynamicsWorld>(
    m_collisionDispatcher.get(),
    m_dbvtBroadphase.get(),
    m_sequentialImpulseConstraintSolver.get(),
    m_collisionConfiguration.get());

	m_discreteDynamicsWorld->setGravity(btVector3(0,-9.8,0));
}

mox::physics::World::~World()
{
}

void mox::physics::World::Init(v8::Local<v8::Object> namespc)
{
  DEFINE_FUNCTION_TEMPLATE("World", tpl);

  Nan::SetPrototypeMethod(tpl, "addRigidBody", addRigidBody);
  Nan::SetPrototypeMethod(tpl, "removeRigidBody", removeRigidBody);
  Nan::SetPrototypeMethod(tpl, "stepSimulation", stepSimulation);
  Nan::SetPrototypeMethod(tpl, "analyse", analyse);

  constructor.Reset(tpl->GetFunction());
  namespc->Set(Nan::New("World").ToLocalChecked(),
    tpl->GetFunction());
}

NAN_METHOD(mox::physics::World::New)
{
  ALLOW_ONLY_CONSTRUCTOR(info);
  World *obj = new World();
  obj->Wrap(info.This());
  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(mox::physics::World::addRigidBody)
{
  CHECK_NUM_ARGUMENTS(info, 1);
  GET_SELF(mox::physics::World, self);

  if (!info[0]->IsUndefined()) {
    mox::physics::RigidBody *rigidBody =
      Nan::ObjectWrap::Unwrap<mox::physics::RigidBody>(info[0]->ToObject());

    btRigidBodyPtr btRigidBody = rigidBody->getRigidBody();
    self->m_discreteDynamicsWorld->addRigidBody(btRigidBody.get());
  }
}

NAN_METHOD(mox::physics::World::removeRigidBody)
{
  CHECK_NUM_ARGUMENTS(info, 1);
  GET_SELF(mox::physics::World, self);

  if (!info[0]->IsUndefined()) {
    mox::physics::RigidBody *rigidBody =
      Nan::ObjectWrap::Unwrap<mox::physics::RigidBody>(info[0]->ToObject());

    btRigidBodyPtr btRigidBody = rigidBody->getRigidBody();
    self->m_discreteDynamicsWorld->removeRigidBody(btRigidBody.get());
  }
}

NAN_METHOD(mox::physics::World::stepSimulation)
{
  CHECK_NUM_ARGUMENTS_GT(info, 0);
  GET_SELF(mox::physics::World, self);

  double timeStep = Nan::To<double>(info[0]).FromJust();

  int maxSubSteps = 10; // default value
  if (info.Length() > 1) {
    maxSubSteps = Nan::To<uint32_t>(info[1]).FromJust();
  }

  double fixedTimeStep = 1.0 / 60.0; // default value
  if (info.Length() > 2) {
    fixedTimeStep = Nan::To<double>(info[2]).FromJust();
  }

  self->m_discreteDynamicsWorld->stepSimulation(
    timeStep, maxSubSteps, fixedTimeStep);
}

NAN_METHOD(mox::physics::World::analyse)
{
  GET_SELF(mox::physics::World, self);
  for (
    int i = self->m_discreteDynamicsWorld->getNumCollisionObjects() - 1;
    i >= 0; i--)
  {
    btCollisionObject *obj = self->m_discreteDynamicsWorld->getCollisionObjectArray()[i];
    btRigidBody *body = btRigidBody::upcast(obj);
    btTransform xform;
    if (body && body->getMotionState()) {
      body->getMotionState()->getWorldTransform(xform);
      MOXLOG("Pos " << i << " = " <<
        "[" << xform.getOrigin().getX() << ","
        << xform.getOrigin().getY() << ","
        << xform.getOrigin().getZ() << "]");
    } else {
      xform = obj->getWorldTransform();
      MOXLOG("x");
    }
  }
}
