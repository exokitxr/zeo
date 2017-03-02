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

  tpl->Set(Nan::New("OBJECT_TYPE").ToLocalChecked(), Nan::New(OBJECT_TYPE));

  Nan::SetPrototypeMethod(tpl, "getMass", getMass);
  Nan::SetPrototypeMethod(tpl, "getPosition", getPosition);
  Nan::SetPrototypeMethod(tpl, "setPosition", setPosition);
  Nan::SetPrototypeMethod(tpl, "getRotation", getRotation);
  Nan::SetPrototypeMethod(tpl, "setRotation", setRotation);
  Nan::SetPrototypeMethod(tpl, "getLinearVelocity",getLinearVelocity);
  Nan::SetPrototypeMethod(tpl, "setLinearVelocity", setLinearVelocity);
  Nan::SetPrototypeMethod(tpl, "getAngularVelocity", getAngularVelocity);
  Nan::SetPrototypeMethod(tpl, "setAngularVelocity", setAngularVelocity);
  Nan::SetPrototypeMethod(tpl, "setLinearFactor", setLinearFactor);
  Nan::SetPrototypeMethod(tpl, "setAngularFactor", setAngularFactor);
  Nan::SetPrototypeMethod(tpl, "activate", activate);
  Nan::SetPrototypeMethod(tpl, "deactivate", deactivate);
  Nan::SetPrototypeMethod(tpl, "disableDeactivation", disableDeactivation);
  Nan::SetPrototypeMethod(tpl, "setIgnoreCollisionCheck", setIgnoreCollisionCheck);

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
  v8::Local<v8::String> keyChildren = Nan::New("children").ToLocalChecked();
  v8::Local<v8::String> keyPosition = Nan::New("position").ToLocalChecked();
  v8::Local<v8::String> keyRotation = Nan::New("rotation").ToLocalChecked();
  v8::Local<v8::String> keyScale = Nan::New("scale").ToLocalChecked();
  v8::Local<v8::String> keyLength = Nan::New("length").ToLocalChecked();
  v8::Local<v8::String> keyMass = Nan::New("mass").ToLocalChecked();
  v8::Local<v8::String> keyObjectType = Nan::New("objectType").ToLocalChecked();

  v8::Local<v8::Object> def = Nan::To<v8::Object>(info[0]).ToLocalChecked();

  // type - decides which kind of collision shape this rigid body has
  MOXCHK(Nan::Has(def, keyType).FromJust());
  v8::Local<v8::Value> typeValue = Nan::Get(def, keyType).ToLocalChecked();
  const uint32_t type = RigidBody::getRigidBodyTypeEnum(typeValue);
  nativeInstance->m_type = type;

  // mass
  if (Nan::Has(def, keyMass).FromJust()) {
    nativeInstance->m_mass = Nan::To<double>(
      Nan::Get(def, keyMass).ToLocalChecked()).FromJust();
  }

  nativeInstance->m_isDynamic = (nativeInstance->m_mass != 0.0f);

  //
  // type-specific construction of rigid body
  //

  instance->Set(keyObjectType, Nan::New(OBJECT_TYPE));
  instance->Set(keyType, Nan::Get(def, keyType).ToLocalChecked());

  switch (type) {
  case BOX: {
    MOXCHK(Nan::Has(def, keyDimensions).FromJust());
    v8::Local<v8::Object> dimensions = Nan::To<v8::Object>(Nan::Get(def, keyDimensions).ToLocalChecked()).ToLocalChecked();
    double dx = Nan::To<double>(Nan::Get(dimensions, 0).ToLocalChecked()).FromJust();
    double dy = Nan::To<double>(Nan::Get(dimensions, 1).ToLocalChecked()).FromJust();
    double dz = Nan::To<double>(Nan::Get(dimensions, 2).ToLocalChecked()).FromJust();
    nativeInstance->m_collisionShape = std::make_shared<btBoxShape>(
      btVector3(btScalar(dx / 2), btScalar(dy / 2), btScalar(dz / 2))
    );

    break;
  }
  case PLANE: {
    MOXCHK(Nan::Has(def, keyDimensions).FromJust());
    v8::Local<v8::Object> dimensions = Nan::To<v8::Object>(Nan::Get(def, keyDimensions).ToLocalChecked()).ToLocalChecked();
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
    v8::Local<v8::Number> sizeValue = Nan::To<v8::Number>(Nan::Get(def, keySize).ToLocalChecked()).ToLocalChecked();
    double size = Nan::To<double>(sizeValue).FromJust();
    nativeInstance->m_collisionShape = std::make_shared<btSphereShape>(
      btScalar(size)
    );

    break;
  }
  case CONVEX_HULL: {
    MOXCHK(Nan::Has(def, keyPoints).FromJust());
    v8::Local<v8::Object> pointsArray = Nan::To<v8::Object>(Nan::Get(def, keyPoints).ToLocalChecked()).ToLocalChecked();

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
      v8::Local<v8::String> errorString = Nan::New(std::string("points size is invalid: ") + std::to_string(numScalars)).ToLocalChecked();
      Nan::ThrowRangeError(errorString);

      return;
    }
    break;
  }
  case COMPOUND: {
    MOXCHK(Nan::Has(def, keyChildren).FromJust());
    v8::Local<v8::Object> childrenArray = Nan::To<v8::Object>(Nan::Get(def, keyChildren).ToLocalChecked()).ToLocalChecked();

    int numChildren = Nan::To<int>(Nan::Get(childrenArray, keyLength).ToLocalChecked()).FromJust();
    if (numChildren > 0) {
      btCompoundShapePtr compoundShape = std::make_shared<btCompoundShape>();

      for (int i = 0; i < numChildren; i++) {
        v8::Local<v8::Object> child = Nan::To<v8::Object>(Nan::Get(childrenArray, i)
          .ToLocalChecked()).ToLocalChecked();

        btCollisionShapePtr childShape;
        uint32_t type = RigidBody::getRigidBodyTypeEnum(Nan::Get(child, keyType).ToLocalChecked());
        switch (type) {
          case BOX: {
            MOXCHK(Nan::Has(child, keyDimensions).FromJust());
            v8::Local<v8::Object> dimensions = Nan::To<v8::Object>(Nan::Get(child, keyDimensions).ToLocalChecked()).ToLocalChecked();
            double dx = Nan::To<double>(Nan::Get(dimensions, 0).ToLocalChecked()).FromJust();
            double dy = Nan::To<double>(Nan::Get(dimensions, 1).ToLocalChecked()).FromJust();
            double dz = Nan::To<double>(Nan::Get(dimensions, 2).ToLocalChecked()).FromJust();
            childShape = std::make_shared<btBoxShape>(
              btVector3(btScalar(dx / 2), btScalar(dy / 2), btScalar(dz / 2))
            );
            break;
          }
          case PLANE: {
            MOXCHK(Nan::Has(child, keyDimensions).FromJust());
            v8::Local<v8::Object> dimensions = Nan::To<v8::Object>(Nan::Get(child, keyDimensions).ToLocalChecked()).ToLocalChecked();
            double dx = Nan::To<double>(Nan::Get(dimensions, 0).ToLocalChecked()).FromJust();
            double dy = Nan::To<double>(Nan::Get(dimensions, 1).ToLocalChecked()).FromJust();
            double dz = Nan::To<double>(Nan::Get(dimensions, 2).ToLocalChecked()).FromJust();
            childShape = std::make_shared<btStaticPlaneShape>(
              btVector3(btScalar(dx), btScalar(dy), btScalar(dz)),
              btScalar(0)
            );
            break;
          }
          case SPHERE: {
            MOXCHK(Nan::Has(def, keySize).FromJust());
            double size = Nan::To<double>(Nan::Get(def, keySize)
              .ToLocalChecked()).FromJust();
            childShape = std::make_shared<btSphereShape>(
              btScalar(size)
            );
            break;
          }
          default:
            std::cerr << "Bullet: invalid compound object type: " << type << std::endl;
            break;
          // XXX add remaining types here
        }

        btTransform xform;
        // position
        v8::Local<v8::Object> position = Nan::To<v8::Object>(Nan::Get(child, keyPosition)
          .ToLocalChecked()).ToLocalChecked();
        double px = Nan::To<double>(Nan::Get(position, 0).ToLocalChecked()).FromJust();
        double py = Nan::To<double>(Nan::Get(position, 1).ToLocalChecked()).FromJust();
        double pz = Nan::To<double>(Nan::Get(position, 2).ToLocalChecked()).FromJust();
        xform.setOrigin(btVector3(px, py, pz));
        // rotation
        v8::Local<v8::Object> rotation = Nan::To<v8::Object>(Nan::Get(child, keyRotation)
          .ToLocalChecked()).ToLocalChecked();
        double rx = Nan::To<double>(Nan::Get(rotation, 0).ToLocalChecked()).FromJust();
        double ry = Nan::To<double>(Nan::Get(rotation, 1).ToLocalChecked()).FromJust();
        double rz = Nan::To<double>(Nan::Get(rotation, 2).ToLocalChecked()).FromJust();
        double rw = Nan::To<double>(Nan::Get(rotation, 3).ToLocalChecked()).FromJust();
        xform.setRotation(btQuaternion(rx, ry, rz, rw));

        compoundShape->addChildShape(xform, childShape.get());
        nativeInstance->m_collisionShapes.push_back(childShape);
      }

      nativeInstance->m_collisionShape = compoundShape;
    } else {
      v8::Local<v8::String> errorString = Nan::New(std::string("number of children is invalid: ") + std::to_string(numChildren)).ToLocalChecked();
      Nan::ThrowRangeError(errorString);

      return;
    }
    break;
  }
  default:
    std::cerr << "Bullet: invalid object type: " << nativeInstance->m_type << std::endl;
    break;
  }

  // scale
  MOXCHK(Nan::Has(def, keyScale).FromJust());
  v8::Local<v8::Object> scale = Nan::To<v8::Object>(Nan::Get(def, keyScale)
    .ToLocalChecked()).ToLocalChecked();
  double sx = Nan::To<double>(Nan::Get(scale, 0).ToLocalChecked()).FromJust();
  double sy = Nan::To<double>(Nan::Get(scale, 1).ToLocalChecked()).FromJust();
  double sz = Nan::To<double>(Nan::Get(scale, 2).ToLocalChecked()).FromJust();
  nativeInstance->m_collisionShape->setLocalScaling(btVector3(sx, sy, sz));

  // inertia
  btVector3 localInertia(0, 0, 0);
  if (nativeInstance->m_isDynamic) {
    nativeInstance->m_collisionShape->calculateLocalInertia(
      nativeInstance->m_mass, localInertia);
  }

  // motion state
  nativeInstance->m_motionState = std::make_shared<btDefaultMotionState>(
    nativeInstance->m_transform);
  btRigidBody::btRigidBodyConstructionInfo rbInfo(
    nativeInstance->m_mass,
    nativeInstance->m_motionState.get(),
    nativeInstance->m_collisionShape.get(),
    localInertia
  );

  // rigid body
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

NAN_METHOD(mox::physics::RigidBody::setLinearFactor)
{
  GET_SELF(mox::physics::RigidBody, self);
  CHECK_NUM_ARGUMENTS(info, 3);
  double x = info[0]->IsUndefined() ? 0 : Nan::To<double>(info[0]).FromJust();
  double y = info[1]->IsUndefined() ? 0 : Nan::To<double>(info[1]).FromJust();
  double z = info[2]->IsUndefined() ? 0 : Nan::To<double>(info[2]).FromJust();

  self->m_rigidBody->setLinearFactor(btVector3(x, y, z));

  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(mox::physics::RigidBody::setAngularFactor)
{
  GET_SELF(mox::physics::RigidBody, self);
  CHECK_NUM_ARGUMENTS(info, 3);
  double x = info[0]->IsUndefined() ? 0 : Nan::To<double>(info[0]).FromJust();
  double y = info[1]->IsUndefined() ? 0 : Nan::To<double>(info[1]).FromJust();
  double z = info[2]->IsUndefined() ? 0 : Nan::To<double>(info[2]).FromJust();

  self->m_rigidBody->setAngularFactor(btVector3(x, y, z));

  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(mox::physics::RigidBody::activate)
{
  GET_SELF(mox::physics::RigidBody, self);

  self->m_rigidBody->activate();

  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(mox::physics::RigidBody::deactivate)
{
  GET_SELF(mox::physics::RigidBody, self);

  self->m_rigidBody->setActivationState(0);

  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(mox::physics::RigidBody::disableDeactivation)
{
  GET_SELF(mox::physics::RigidBody, self);

  self->m_rigidBody->setActivationState(DISABLE_DEACTIVATION);

  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(mox::physics::RigidBody::setIgnoreCollisionCheck)
{
  GET_SELF(mox::physics::RigidBody, self);
  CHECK_NUM_ARGUMENTS(info, 2);

  v8::Local<v8::Object> rigidBodyObject = Nan::To<v8::Object>(info[0]).ToLocalChecked();
  RigidBody *rigidBody = ObjectWrap::Unwrap<RigidBody>(rigidBodyObject);
  bool ignore = Nan::To<bool>(info[1]).FromJust();

  self->m_rigidBody->setIgnoreCollisionCheck(rigidBody->getRigidBody().get(), ignore);

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

uint32_t mox::physics::RigidBody::getRigidBodyTypeEnum(const v8::Local<v8::Value> &val) {
  v8::Local<v8::String> typeValue = Nan::To<v8::String>(val).ToLocalChecked();
  v8::String::Utf8Value typeUtf8Value(typeValue);
  std::string typeString(*typeUtf8Value);
  uint32_t type = -1;
  if (typeString == "box") {
    type = BOX;
  } else if (typeString == "plane") {
    type = PLANE;
  } else if (typeString == "sphere") {
    type = SPHERE;
  } else if (typeString == "convexHull") {
    type = CONVEX_HULL;
  } else if (typeString == "triangleMesh") {
    type = TRIANGLE_MESH;
  } else if (typeString == "compound") {
    type = COMPOUND;
  }
  return type;
}
