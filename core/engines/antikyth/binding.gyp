{
  "targets": [
    {
      "target_name": "physics",
      "include_dirs" : [
        "<!(node -e \"require('nan')\")",
          "<(BULLET_PHYSICS_ROOT)/include/bullet",
          "<(BULLET_PHYSICS_ROOT)/src",
          "inc"
      ],
      "libraries" : [
        "<(BULLET_PHYSICS_ROOT)/bullet-build/src/BulletDynamics/libBulletDynamics.a",
        "<(BULLET_PHYSICS_ROOT)/bullet-build/src/BulletCollision/libBulletCollision.a",
        "<(BULLET_PHYSICS_ROOT)/bullet-build/src/LinearMath/libLinearMath.a",
      ],
      "sources": [
        "<!@(node -e \"console.log(require('fs').readdirSync('./src').map(f=>'src/'+f).join(' '))\")",
        "<!@(node -e \"console.log(require('fs').readdirSync('./inc').map(f=>'inc/'+f).join(' '))\")"
      ]
    }
  ]
}
