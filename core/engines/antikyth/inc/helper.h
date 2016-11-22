
#include <iostream>
#include <sstream>

#define INIT_HELPER(name) \
  Nan::HandleScope scope; \
  v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(New);\
  tpl->SetClassName(Nan::New(name).ToLocalChecked()); \
  tpl->InstanceTemplate()->SetInternalFieldCount(1); \
  constructor.Reset(tpl->GetFunction()); \
  namespc->Set(Nan::New(name).ToLocalChecked(), tpl->GetFunction());

#define DEFINE_FUNCTION_TEMPLATE(name, tpl) \
  v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(New); \
  tpl->SetClassName(Nan::New(name).ToLocalChecked()); \
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

#define CHECK_NUM_ARGUMENTS(args, length) \
  if(args.Length() != length) { \
    Nan::ThrowError("Wrong number of arguments"); \
    return; \
  }

#define CHECK_NUM_ARGUMENTS_GT(args, length) \
  if(args.Length() <= length) { \
    Nan::ThrowError("Wrong number of arguments"); \
    return; \
  }

#define CHECK_NUM_ARGUMENTS_LT(args, length) \
  if(args.Length() >= length) { \
    Nan::ThrowError("Wrong number of arguments"); \
    return; \
  }

#define ALLOW_ONLY_CONSTRUCTOR(info) \
  if(!info.IsConstructCall()) { \
    Nan::ThrowError("Only constructor usage with new is supported"); \
    return; \
  }

#define GET_SELF(type, var) \
  type *var = ObjectWrap::Unwrap<type>(info.Holder());

#define __FILENAME__ \
  (strrchr(__FILE__, '/') ? strrchr(__FILE__, '/') + 1 : __FILE__)

#define MOXLOG(msg) \
  std::cout << "[" << __FILENAME__ << ":" << __LINE__ << "] " << msg << std::endl;

#define MOXCHK(condition) \
  if(!(condition)) { \
    std::stringstream ss; \
    ss << "Assertion failed at [" << __FILENAME__ << ":" << __LINE__ << "]"; \
    Nan::ThrowError(Nan::New(ss.str()).ToLocalChecked()); \
  }