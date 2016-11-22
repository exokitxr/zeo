#pragma once

#include <memory>
#include "btBulletDynamicsCommon.h"

namespace mox {
  namespace physics {
    typedef std::shared_ptr<btDefaultCollisionConfiguration>
      btDefaultCollisionConfigurationPtr;

    typedef std::shared_ptr<btCollisionDispatcher>
      btCollisionDispatcherPtr;

    typedef std::shared_ptr<btDbvtBroadphase>
      btDbvtBroadphasePtr;

    typedef std::shared_ptr<btSequentialImpulseConstraintSolver>
      btSequentialImpulseConstraintSolverPtr;

    typedef std::shared_ptr<btDiscreteDynamicsWorld>
      btDiscreteDynamicsWorldPtr;

    typedef std::shared_ptr<btCollisionShape>
      btCollisionShapePtr;

    typedef std::shared_ptr<btTriangleMesh>
      btTriangleMeshPtr;

    typedef std::shared_ptr<btDefaultMotionState>
      btDefaultMotionStatePtr;

    typedef std::shared_ptr<btRigidBody>
      btRigidBodyPtr;
  }
}
