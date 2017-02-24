export class MapPoint {
  constructor(
    elevation = 0,
    moisture = 0,
    land = false,
    water = false,
    ocean = false,
    lake = false,
    lava = 0
  ) {
    this.elevation = elevation;
    this.moisture = moisture;
    this.land = land;
    this.water = water;
    this.ocean = ocean;
    this.lake = lake;
    this.lava = lava;
  }
}
