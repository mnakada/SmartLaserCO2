///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////



$(document).ready(function(){

  $('#cutting_area').height(app_settings.canvas_dimensions[1]);
  $('#x_location_field').val('');
  $('#y_location_field').val('');

  var isDragging = false;
  
  function assemble_and_send_gcode(x, y, do_not_scale) {
    // x or y can be NaN or null
    // this allows for moving only along x or y
    var x_phy;
    var y_phy;
    if (do_not_scale == null || do_not_scale === false) {
      x_phy = x*app_settings.to_physical_scale;
      y_phy = y*app_settings.to_physical_scale;
    } else {
      x_phy = x;
      y_phy = y;
    }
    /// contrain
    if (!(isNaN(x_phy)) && x_phy != null) {  // allow for NaN, null
      if (x_phy < 0) {
        x_phy = 0;
        $().uxmessage('warning', "x target constrained to work area");
      } else if (x_phy > app_settings.work_area_dimensions[0]) {
        x_phy = app_settings.work_area_dimensions[0];
        $().uxmessage('warning', "x target constrained to work area");
      }
    }
    if (!(isNaN(y_phy)) && y_phy != null) {
      if (y_phy < 0) {
        y_phy = 0;
        $().uxmessage('warning', "y target constrained to work area");
      } else if (y_phy > app_settings.work_area_dimensions[1]) {
        y_phy = app_settings.work_area_dimensions[1];
        $().uxmessage('warning', "y target constrained to work area");
      }
    }
    var g0_or_g1 = 'G0';
    var air_assist_on = '';
    var air_assist_off = '';
    if($('#feed_btn').hasClass("active")){
      g0_or_g1 = 'G1';
      air_assist_on = 'M80\n';
      air_assist_off = 'M81\n';
    }
    var feedrate = DataHandler.mapConstrainFeedrate($("#feedrate_field" ).val());
    var intensity =  DataHandler.mapConstrainIntesity($( "#intensity_field" ).val());
    var gcode = 'G90\n'+air_assist_on+'S'+ intensity + '\n' + g0_or_g1;
    if (!(isNaN(x_phy)) && x_phy != null) {
      gcode += 'X' + x_phy.toFixed(app_settings.num_digits);
    }
    if (!(isNaN(y_phy)) && y_phy != null) {
      gcode += 'Y' + y_phy.toFixed(app_settings.num_digits)
    }
    gcode += 'F' + feedrate + '\nS0\n'+air_assist_off; 
    // $().uxmessage('notice', gcode);
    send_gcode(gcode, "Motion request sent.", false);    
  }
  
  function assemble_info_text(x,y) {
    var x_phy = x*app_settings.to_physical_scale;
    var y_phy = y*app_settings.to_physical_scale;
    var coords_text;
    var move_or_cut = 'move';
    if($('#feed_btn').hasClass("active")){
      move_or_cut = 'cut';
    }
    var feedrate = DataHandler.mapConstrainFeedrate($( "#feedrate_field" ).val());
    var intensity =  DataHandler.mapConstrainIntesity($( "#intensity_field" ).val());
    var coords_text;
    if (move_or_cut == 'cut') {
      coords_text = move_or_cut + ' to (' + 
                    x_phy.toFixed(0) + ', '+ 
                    y_phy.toFixed(0) + ') at ' + 
                    feedrate + 'mm/min and ' + Math.round(intensity/2.55) + '% intensity';
    } else {
      coords_text = move_or_cut + ' to (' + x_phy.toFixed(0) + ', '+ 
                    y_phy.toFixed(0) + ') at ' + feedrate + 'mm/min'
    }
    return coords_text;
  }


  $("#cutting_area").mousedown(function() {
    isDragging = true;
  }).mouseup(function() {
    isDragging = false;
  });
  

  $("#cutting_area").click(function(e) {
    var offset = $(this).offset();
    var x = (e.pageX - offset.left);
    var y = (e.pageY - offset.top);

    assemble_and_send_gcode(x,y);
    return false;
  });


  $("#cutting_area").hover(
    function () {
      $(this).css('border', '1px dashed #ff0000');
      $(this).css('cursor', 'crosshair');
    },
    function () {
      $(this).css('border', '1px dashed #aaaaaa');
      $(this).css('cursor', 'pointer'); 
      $('#coordinates_info').text('');    
    }
  );
  
  $("#cutting_area").mousemove(function (e) {
    var offset = $(this).offset();
    var x = (e.pageX - offset.left);
    var y = (e.pageY - offset.top);
    coords_text = assemble_info_text(x,y);
    if (e.altKey &&isDragging) {
        assemble_and_send_gcode(x,y);
    }
    $('#coordinates_info').text(coords_text);
  });

  /// motion parameters /////////////////////////

  $("#intensity_field" ).val('0');
  $("#feedrate_field" ).val(app_settings.max_seek_speed);
  
  $("#seek_btn").click(function(e) {
    $("#intensity_field" ).hide();
    $("#intensity_field_disabled" ).show();
    $('#loc_move_cut_word').html('Move');
  });  
  $("#feed_btn").click(function(e) {
    $("#intensity_field_disabled" ).hide();
    $("#intensity_field" ).show();
    $('#loc_move_cut_word').html('Cut');
  });   
  
  $("#feedrate_btn_slow").click(function(e) {
    $("#feedrate_field" ).val("600");
  });  
  $("#feedrate_btn_medium").click(function(e) {
    $("#feedrate_field" ).val("2000");
  });  
  $("#feedrate_btn_fast").click(function(e) {
    $("#feedrate_field" ).val(app_settings.max_seek_speed);
  });  
  $("#feedrate_field").focus(function(e) {
    $("#feedrate_btn_slow").removeClass('active');
    $("#feedrate_btn_medium").removeClass('active');
    $("#feedrate_btn_fast").removeClass('active');
  });
  
  if ($("#feedrate_field" ).val() != app_settings.max_seek_speed) {
    $("#feedrate_btn_slow").removeClass('active');
    $("#feedrate_btn_medium").removeClass('active');
    $("#feedrate_btn_fast").removeClass('active');    
  }
  

  /// jog buttons ///////////////////////////////

  $("#jog_up_btn").click(function(e) {
    var gcode = 'G91\nG0Y-10F6000\nG90\n';
    send_gcode(gcode, "Moving Up ...", false);
  });   
  $("#jog_left_btn").click(function(e) {
    var gcode = 'G91\nG0X-10F6000\nG90\n';
    send_gcode(gcode, "Moving Left ...", false);
  });   
  $("#jog_right_btn").click(function(e) {
    var gcode = 'G91\nG0X10F6000\nG90\n';
    send_gcode(gcode, "Moving Right ...", false);
  });
  $("#jog_down_btn").click(function(e) {
    var gcode = 'G91\nG0Y10F6000\nG90\n';
    send_gcode(gcode, "Moving Down ...", false);
  });


  /// jog keys //////////////////////////////////

  $(document).on('keydown', null, 'right', function(e){
    if ($('#tab_mover').is(":visible")) {
      var gcode = 'G91\nG0X10F6000\nG90\n';
      send_gcode(gcode, "Moving Right ...", false);
      return false;
    }
  });
  $(document).on('keydown', null, 'alt+right', function(e){
    if ($('#tab_mover').is(":visible")) {
      var gcode = 'G91\nG0X2F6000\nG90\n';
      send_gcode(gcode, "Moving Right ...", false);
      return false;
    }
  });
  $(document).on('keydown', null, 'shift+right', function(e){
    if ($('#tab_mover').is(":visible")) {
      var gcode = 'G91\nG0X50F6000\nG90\n';
      send_gcode(gcode, "Moving Right ...", false);
      return false;
    }
  });

  $(document).on('keydown', null, 'left', function(e){
    if ($('#tab_mover').is(":visible")) {
      var gcode = 'G91\nG0X-10F6000\nG90\n';
      send_gcode(gcode, "Moving Left ...", false);
      return false;
    }
  });
  $(document).on('keydown', null, 'alt+left', function(e){
    if ($('#tab_mover').is(":visible")) {
      var gcode = 'G91\nG0X-2F6000\nG90\n';
      send_gcode(gcode, "Moving Left ...", false);
      return false;
    }
  });
  $(document).on('keydown', null, 'shift+left', function(e){
    if ($('#tab_mover').is(":visible")) {
      var gcode = 'G91\nG0X-50F6000\nG90\n';
      send_gcode(gcode, "Moving Left ...", false);
      return false;
    }
  });

  $(document).on('keydown', null, 'up', function(e){
    if ($('#tab_mover').is(":visible")) {
      var gcode = 'G91\nG0Y-10F6000\nG90\n';
      send_gcode(gcode, "Moving Up ...", false);
      return false;
    }
  });
  $(document).on('keydown', null, 'alt+up', function(e){
    if ($('#tab_mover').is(":visible")) {
      var gcode = 'G91\nG0Y-2F6000\nG90\n';
      send_gcode(gcode, "Moving Up ...", false);
      return false;
    }
  });
  $(document).on('keydown', null, 'shift+up', function(e){
    if ($('#tab_mover').is(":visible")) {
      var gcode = 'G91\nG0Y-50F6000\nG90\n';
      send_gcode(gcode, "Moving Up ...", false);
      return false;
    }
  });

  $(document).on('keydown', null, 'down', function(e){
    if ($('#tab_mover').is(":visible")) {
      var gcode = 'G91\nG0Y10F6000\nG90\n';
      send_gcode(gcode, "Moving Down ...", false);
      return false;
    }
  });
  $(document).on('keydown', null, 'alt+down', function(e){
    if ($('#tab_mover').is(":visible")) {
      var gcode = 'G91\nG0Y2F6000\nG90\n';
      send_gcode(gcode, "Moving Down ...", false);
      return false;
    }
  });
  $(document).on('keydown', null, 'shift+down', function(e){
    if ($('#tab_mover').is(":visible")) {
      var gcode = 'G91\nG0Y50F6000\nG90\n';
      send_gcode(gcode, "Moving Down ...", false);
      return false;
    }
  });
      

  /// numeral location buttons //////////////////
  $("#location_set_btn").click(function(e) {
    var x = parseFloat($('#x_location_field').val());
    var y = parseFloat($('#y_location_field').val());
    // NaN from parsing '' is ok
    assemble_and_send_gcode(x, y, true);
  }); 


});  // ready
