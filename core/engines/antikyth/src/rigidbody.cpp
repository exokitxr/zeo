
#include "helper.h"
#include "btBulletDynamicsCommon.h"
#include "pointers.h"
#include "rigidbody.h"

Nan::Persistent<v8::Function> mox::physics::RigidBody::constructor;

mox::physics::RigidBody::RigidBody()
{
  m_transform.setIdentity();
  m_mass = 0;
}

mox::physics::RigidBody::~RigidBody()
{

}

void mox::physics::RigidBody::Init(v8::Local<v8::Object> namespc)
{
  DEFINE_FUNCTION_TEMPLATE("RigidBody", tpl);

  Nan::SetMethod(tpl, "make", make);

  tpl->Set(Nan::New("BOX").ToLocalChecked(), Nan::New(BOX));
  tpl->Set(Nan::New("PLANE").ToLocalChecked(), Nan::New(PLANE));
  tpl->Set(Nan::New("SPHERE").ToLocalChecked(), Nan::New(SPHERE));
  tpl->Set(Nan::New("CONVEX_HULL").ToLocalChecked(), Nan::New(CONVEX_HULL));
  tpl->Set(Nan::New("TRIANGLE_MESH").ToLocalChecked(), Nan::New(TRIANGLE_MESH));

  Nan::SetPrototypeMethod(tpl, "getMass", getMass);
  Nan::SetPrototypeMethod(tpl, "getPosition", getPosition);
  Nan::SetPrototypeMethod(tpl, "setPosition", setPosition);
  Nan::SetPrototypeMethod(tpl, "getRotation", getRotation);
  Nan::SetPrototypeMethod(tpl, "setRotation", setRotation);
  Nan::SetPrototypeMethod(tpl, "getLinearVelocity",getLinearVelocity);
  Nan::SetPrototypeMethod(tpl, "setLinearVelocity", setLinearVelocity);
  Nan::SetPrototypeMethod(tpl, "getAngularVelocity", getAngularVelocity);
  Nan::SetPrototypeMethod(tpl, "setAngularVelocity", setAngularVelocity);

  constructor.Reset(tpl->GetFunction());
  namespc->Set(Nan::New("RigidBody").ToLocalChecked(), tpl->GetFunction());

}

NAN_METHOD(mox::physics::RigidBody::New)
{
  ALLOW_ONLY_CONSTRUCTOR(info);
  RigidBody *obj = new RigidBody();
  obj->Wrap(info.This());
  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(mox::physics::RigidBody::make)
{
  CHECK_NUM_ARGUMENTS(info, 1);

  v8::Local<v8::Object> instance = NewInstance();
  RigidBody *nativeInstance = ObjectWrap::Unwrap<RigidBody>(instance);

  v8::Local<v8::String> keyType = Nan::New("type").ToLocalChecked();
  v8::Local<v8::String> keyDimensions = Nan::New("dimensions").ToLocalChecked();
  v8::Local<v8::String> keySize = Nan::New("size").ToLocalChecked();
  v8::Local<v8::String> keyPoints = Nan::New("points").ToLocalChecked();
  v8::Local<v8::String> keyLength = Nan::New("length").ToLocalChecked();
  // v8::Local<v8::String> keyPosition = Nan::New("position").ToLocalChecked();
  v8::Local<v8::String> keyMass = Nan::New("mass").ToLocalChecked();

  v8::Local<v8::Object> def = Nan::To<v8::Object>(info[0]).ToLocalChecked();

  // type - decides which kind of collision shape this rigid body has
  MOXCHK(Nan::Has(def, keyType).FromJust());
  nativeInstance->m_type = Nan::To<uint32_t>(
    Nan::Get(def, keyType).ToLocalChecked()).FromJust();

  // mass
  if (Nan::Has(def, keyMass).FromJust()) {
    nativeInstance->m_mass = Nan::To<double>(
      Nan::Get(def, keyMass).ToLocalChecked()).FromJust();
  }

  nativeInstance->m_isDynamic = (nativeInstance->m_mass != 0.0f);

  /* // position
  v8::Local<v8::Object> position;
  double x=0, y=0, z=0;

  if (Nan::Has(def, keyPosition).FromJust()) {
    position = Nan::To<v8::Object>(Nan::Get(def, keyPosition)
      .ToLocalChecked()).ToLocalChecked();
    x = Nan::To<double>(Nan::Get(position, 0).ToLocalChecked()).FromJust();
    y = Nan::To<double>(Nan::Get(position, 1).ToLocalChecked()).FromJust();
    z = Nan::To<double>(Nan::Get(position, 2).ToLocalChecked()).FromJust();
    nativeInstance->m_transform.setOrigin(btVector3(x, y, z));
  } */


  //
  // type-specific construction of rigid body
  //

  switch (nativeInstance->m_type) {
  case BOX: {
    MOXCHK(Nan::Has(def, keyDimensions).FromJust());
    v8::Local<v8::Object> dimensions = Nan::To<v8::Object>(Nan::Get(def, keyDimensions)
      .ToLocalChecked()).ToLocalChecked();
    double dx = Nan::To<double>(Nan::Get(dimensions, 0).ToLocalChecked()).FromJust();
    double dy = Nan::To<double>(Nan::Get(dimensions, 1).ToLocalChecked()).FromJust();
    double dz = Nan::To<double>(Nan::Get(dimensions, 2).ToLocalChecked()).FromJust();
    nativeInstance->m_collisionShape = std::make_shared<btBoxShape>(
      btVector3(btScalar(dx), btScalar(dy), btScalar(dz))
    );
    break;
  }
  case PLANE: {
    MOXCHK(Nan::Has(def, keyDimensions).FromJust());
    v8::Local<v8::Object> dimensions = Nan::To<v8::Object>(Nan::Get(def, keyDimensions)
      .ToLocalChecked()).ToLocalChecked();
    double dx = Nan::To<double>(Nan::Get(dimensions, 0).ToLocalChecked()).FromJust();
    double dy = Nan::To<double>(Nan::Get(dimensions, 1).ToLocalChecked()).FromJust();
    double dz = Nan::To<double>(Nan::Get(dimensions, 2).ToLocalChecked()).FromJust();
    nativeInstance->m_collisionShape = std::make_shared<btStaticPlaneShape>(
      btVector3(btScalar(dx), btScalar(dy), btScalar(dz)),
      btScalar(0)
    );
    break;
  }
  case SPHERE: {
    MOXCHK(Nan::Has(def, keySize).FromJust());
    double size = Nan::To<double>(Nan::Get(def, keySize)
      .ToLocalChecked()).FromJust();
    nativeInstance->m_collisionShape = std::make_shared<btSphereShape>(
      btScalar(size)
    );
    break;
  }
  case CONVEX_HULL: {
    MOXCHK(Nan::Has(def, keyPoints).FromJust());
    v8::Local<v8::Object> pointsArray = Nan::To<v8::Object>(Nan::Get(def, keyPoints)
      .ToLocalChecked()).ToLocalChecked();

    int numScalars = Nan::To<int>(Nan::Get(pointsArray, keyLength).ToLocalChecked()).FromJust();
    if (numScalars % 3 == 0) {
      btScalar points[numScalars];
      for (int i = 0; i < numScalars; i++) {
        points[i] = btScalar(Nan::To<double>(Nan::Get(pointsArray, i).ToLocalChecked()).FromJust());
      }
      int numPoints = numScalars / 3;

      nativeInstance->m_collisionShape = std::make_shared<btConvexHullShape>(
        (btScalar *)points,
        numPoints
      );
    } else {
      Nan::ThrowRangeError("points size is invalid");
    }
    break;
  }
  case TRIANGLE_MESH: {
    MOXCHK(Nan::Has(def, keyPoints).FromJust());
    v8::Local<v8::Object> pointsArray = Nan::To<v8::Object>(Nan::Get(def, keyPoints)
      .ToLocalChecked()).ToLocalChecked();

    int numScalars = Nan::To<int>(Nan::Get(pointsArray, keyLength).ToLocalChecked()).FromJust();
    if (numScalars % 9 == 0) {
      int numPoints = numScalars / 3;
      int numTriangles = numPoints / 3;

      nativeInstance->m_triangleMesh = std::make_shared<btTriangleMesh>();
      for (int i = 0; i < numTriangles; i++) {
        int baseIndex = i * 3 * 3;
        nativeInstance->m_triangleMesh->addTriangle(
          btVector3(
            btScalar(Nan::To<double>(Nan::Get(pointsArray, baseIndex + 0).ToLocalChecked()).FromJust()),
            btScalar(Nan::To<double>(Nan::Get(pointsArray, baseIndex + 1).ToLocalChecked()).FromJust()),
            btScalar(Nan::To<double>(Nan::Get(pointsArray, baseIndex + 2).ToLocalChecked()).FromJust())
          ),
          btVector3(
            btScalar(Nan::To<double>(Nan::Get(pointsArray, baseIndex + 3).ToLocalChecked()).FromJust()),
            btScalar(Nan::To<double>(Nan::Get(pointsArray, baseIndex + 4).ToLocalChecked()).FromJust()),
            btScalar(Nan::To<double>(Nan::Get(pointsArray, baseIndex + 5).ToLocalChecked()).FromJust())
          ),
          btVector3(
            btScalar(Nan::To<double>(Nan::Get(pointsArray, baseIndex + 6).ToLocalChecked()).FromJust()),
            btScalar(Nan::To<double>(Nan::Get(pointsArray, baseIndex + 7).ToLocalChecked()).FromJust()),
            btScalar(Nan::To<double>(Nan::Get(pointsArray, baseIndex + 8).ToLocalChecked()).FromJust())
          ),
          false
        );
      }

      nativeInstance->m_collisionShape = std::make_shared<btBvhTriangleMeshShape>(
        nativeInstance->m_triangleMesh.get(),
        false
      );
    } else {
      Nan::ThrowRangeError("points size is invalid");
    }
    break;
  }
  }

  btVector3 localInertia(0, 0, 0);
  if (nativeInstance->m_isDynamic) {
    nativeInstance->m_collisionShape->calculateLocalInertia(
      nativeInstance->m_mass, localInertia);
  }

  nativeInstance->m_motionState = std::make_shared<btDefaultMotionState>(
    nativeInstance->m_transform);
  btRigidBody::btRigidBodyConstructionInfo rbInfo(
    nativeInstance->m_mass,
    nativeInstance->m_motionState.get(),
    nativeInstance->m_collisionShape.get(),
    localInertia
  );

  nativeInstance->m_rigidBody = std::make_shared<btRigidBody>(rbInfo);

  info.GetReturnValue().Set(instance);
}

NAN_METHOD(mox::physics::RigidBody::getMass)
{
  GET_SELF(mox::physics::RigidBody, self);
  info.GetReturnValue().Set(Nan::New<v8::Number>(self->m_mass));
}

NAN_METHOD(mox::physics::RigidBody::getPosition)
{
  GET_SELF(mox::physics::RigidBody, self);
  v8::Local<v8::Array> position = Nan::New<v8::Array>(3);

  btTransform xform;
  self->m_motionState->getWorldTransform(xform);
  Nan::Set(position, 0, Nan::New<v8::Number>(xform.getOrigin().getX()));
  Nan::Set(position, 1, Nan::New<v8::Number>(xform.getOrigin().getY()));
  Nan::Set(position, 2, Nan::New<v8::Number>(xform.getOrigin().getZ()));

  info.GetReturnValue().Set(position);
}

NAN_METHOD(mox::physics::RigidBody::setPosition)
{
  GET_SELF(mox::physics::RigidBody, self);
  CHECK_NUM_ARGUMENTS(info, 3);
  double x = info[0]->IsUndefined() ? 0 : Nan::To<double>(info[0]).FromJust();
  double y = info[1]->IsUndefined() ? 0 : Nan::To<double>(info[1]).FromJust();
  double z = info[2]->IsUndefined() ? 0 : Nan::To<double>(info[2]).FromJust();

  btTransform xform = self->m_rigidBody->getCenterOfMassTransform();
  xform.setOrigin(btVector3(x, y, z));
  self->m_rigidBody->setCenterOfMassTransform(xform);
  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(mox::physics::RigidBody::getRotation)
{
  GET_SELF(mox::physics::RigidBody, self);
  v8::Local<v8::Array> rotation = Nan::New<v8::Array>(4);

  btTransform xform;
  self->m_motionState->getWorldTransform(xform);
  Nan::Set(rotation, 0, Nan::New<v8::Number>(xform.getRotation().x()));
  Nan::Set(rotation, 1, Nan::New<v8::Number>(xform.getRotation().y()));
  Nan::Set(rotation, 2, Nan::New<v8::Number>(xform.getRotation().z()));
  Nan::Set(rotation, 3, Nan::New<v8::Number>(xform.getRotation().w()));

  info.GetReturnValue().Set(rotation);
}

NAN_METHOD(mox::physics::RigidBody::setRotation)
{
  GET_SELF(mox::physics::RigidBody, self);
  CHECK_NUM_ARGUMENTS(info, 4);
  double x = info[0]->IsUndefined() ? 0 : Nan::To<double>(info[0]).FromJust();
  double y = info[1]->IsUndefined() ? 0 : Nan::To<double>(info[1]).FromJust();
  double z = info[2]->IsUndefined() ? 0 : Nan::To<double>(info[2]).FromJust();
  double w = info[3]->IsUndefined() ? 0 : Nan::To<double>(info[3]).FromJust();

  btTransform xform = self->m_rigidBody->getCenterOfMassTransform();
  xform.setRotation(btQuaternion(x, y, z, w));
  self->m_rigidBody->setCenterOfMassTransform(xform);
  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(mox::physics::RigidBody::getLinearVelocity)
{
  GET_SELF(mox::physics::RigidBody, self);
  v8::Local<v8::Array> linearVelocity = Nan::New<v8::Array>(3);

  btVector3 lv = self->m_rigidBody->getLinearVelocity();
  Nan::Set(linearVelocity, 0, Nan::New<v8::Number>(lv.getX()));
  Nan::Set(linearVelocity, 1, Nan::New<v8::Number>(lv.getY()));
  Nan::Set(linearVelocity, 2, Nan::New<v8::Number>(lv.getZ()));

  info.GetReturnValue().Set(linearVelocity);
}

NAN_METHOD(mox::physics::RigidBody::setLinearVelocity)
{
  GET_SELF(mox::physics::RigidBody, self);
  CHECK_NUM_ARGUMENTS(info, 3);
  double x = info[0]->IsUndefined() ? 0 : Nan::To<double>(info[0]).FromJust();
  double y = info[1]->IsUndefined() ? 0 : Nan::To<double>(info[1]).FromJust();
  double z = info[2]->IsUndefined() ? 0 : Nan::To<double>(info[2]).FromJust();

  self->m_rigidBody->setLinearVelocity(btVector3(x, y, z));
  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(mox::physics::RigidBody::getAngularVelocity)
{
  GET_SELF(mox::physics::RigidBody, self);
  v8::Local<v8::Array> angularVelocity = Nan::New<v8::Array>(3);

  btVector3 av = self->m_rigidBody->getLinearVelocity();
  Nan::Set(angularVelocity, 0, Nan::New<v8::Number>(av.getX()));
  Nan::Set(angularVelocity, 1, Nan::New<v8::Number>(av.getY()));
  Nan::Set(angularVelocity, 2, Nan::New<v8::Number>(av.getZ()));

  info.GetReturnValue().Set(angularVelocity);
}

NAN_METHOD(mox::physics::RigidBody::setAngularVelocity)
{
  GET_SELF(mox::physics::RigidBody, self);
  CHECK_NUM_ARGUMENTS(info, 3);
  double x = info[0]->IsUndefined() ? 0 : Nan::To<double>(info[0]).FromJust();
  double y = info[1]->IsUndefined() ? 0 : Nan::To<double>(info[1]).FromJust();
  double z = info[2]->IsUndefined() ? 0 : Nan::To<double>(info[2]).FromJust();

  self->m_rigidBody->setAngularVelocity(btVector3(x, y, z));
  info.GetReturnValue().Set(info.This());
}

v8::Local<v8::Object> mox::physics::RigidBody::NewInstance()
{
  Nan::EscapableHandleScope scope;

  const unsigned argc = 1;
  v8::Local<v8::Value> argv[1] = {Nan::New("xxx").ToLocalChecked()};
  v8::Local<v8::Function> cons = Nan::New<v8::Function>(constructor);
  v8::Local<v8::Object> instance = cons->NewInstance(argc, argv);

  return scope.Escape(instance);
}
