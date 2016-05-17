
var app_settings = {
  work_area_dimensions: [580,400],
  max_seek_speed: 8000,
  default_feedrate: 1000,
  default_intensity: 100,
  num_digits: 2, 
  max_num_queue_items: 24,
  max_segment_length: 5.0,
  table_offset: [5,5],  // has to match firmware
  disable_power_on: true,
}


///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// calculate preview height from work_area aspect ratio
// preview with is fixed to 610
app_settings.canvas_dimensions = 
    [610, Math.floor(app_settings.work_area_dimensions[1]*
                     (610.0/app_settings.work_area_dimensions[0]))]

app_settings.to_physical_scale = 
    app_settings.work_area_dimensions[0]/app_settings.canvas_dimensions[0];

app_settings.to_canvas_scale = 1.0/app_settings.to_physical_scale;
     
