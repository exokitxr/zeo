#include "helper.h"
#include "btBulletDynamicsCommon.h"
// #include "../bullet3/src/BulletDynamics/ConstraintSolver/btPoint2PointConstraint.h"
#include "pointers.h"
#include "rigidbody.h"
#include "constraint.h"

Nan::Persistent<v8::Function> mox::physics::Constraint::constructor;

mox::physics::Constraint::Constraint()
{

}

mox::physics::Constraint::~Constraint()
{

}

void mox::physics::Constraint::Init(v8::Local<v8::Object> namespc)
{
  DEFINE_FUNCTION_TEMPLATE("Constraint", tpl);

  Nan::SetMethod(tpl, "make", make);

  tpl->Set(Nan::New("OBJECT_TYPE").ToLocalChecked(), Nan::New(OBJECT_TYPE));

  constructor.Reset(tpl->GetFunction());
  namespc->Set(Nan::New("Constraint").ToLocalChecked(), tpl->GetFunction());

}

NAN_METHOD(mox::physics::Constraint::New)
{
  ALLOW_ONLY_CONSTRUCTOR(info);
  Constraint *obj = new Constraint();
  obj->Wrap(info.This());
  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(mox::physics::Constraint::make)
{
  CHECK_NUM_ARGUMENTS(info, 4);

  v8::Local<v8::Object> bodyA = Nan::To<v8::Object>(info[0]).ToLocalChecked();
  v8::Local<v8::Object> bodyB = Nan::To<v8::Object>(info[1]).ToLocalChecked();
  v8::Local<v8::Object> pivotA = Nan::To<v8::Object>(info[2]).ToLocalChecked();
  v8::Local<v8::Object> pivotB = Nan::To<v8::Object>(info[3]).ToLocalChecked();

  RigidBody *bodyAInstance = ObjectWrap::Unwrap<RigidBody>(bodyA);
  RigidBody *bodyBInstance = ObjectWrap::Unwrap<RigidBody>(bodyB);

  double pax = Nan::To<double>(Nan::Get(pivotA, 0).ToLocalChecked()).FromJust();
  double pay = Nan::To<double>(Nan::Get(pivotA, 1).ToLocalChecked()).FromJust();
  double paz = Nan::To<double>(Nan::Get(pivotA, 2).ToLocalChecked()).FromJust();
  double pbx = Nan::To<double>(Nan::Get(pivotB, 0).ToLocalChecked()).FromJust();
  double pby = Nan::To<double>(Nan::Get(pivotB, 1).ToLocalChecked()).FromJust();
  double pbz = Nan::To<double>(Nan::Get(pivotB, 2).ToLocalChecked()).FromJust();

  v8::Local<v8::Object> instance = NewInstance();
  Constraint *nativeInstance = ObjectWrap::Unwrap<Constraint>(instance);

  v8::Local<v8::String> keyObjectType = Nan::New("objectType").ToLocalChecked();

  instance->Set(keyObjectType, Nan::New(OBJECT_TYPE));

  nativeInstance->m_constraint = std::make_shared<btPoint2PointConstraint>(
    *(bodyAInstance->getRigidBody()),
    *(bodyBInstance->getRigidBody()),
    btVector3(pax, pay, paz),
    btVector3(pbx, pby, pbz)
  );

  info.GetReturnValue().Set(instance);
}

v8::Local<v8::Object> mox::physics::Constraint::NewInstance()
{
  Nan::EscapableHandleScope scope;

  const unsigned argc = 1;
  v8::Local<v8::Value> argv[1] = {Nan::New("xxx").ToLocalChecked()};
  v8::Local<v8::Function> cons = Nan::New<v8::Function>(constructor);
  v8::Local<v8::Object> instance = cons->NewInstance(argc, argv);

  return scope.Escape(instance);
}
