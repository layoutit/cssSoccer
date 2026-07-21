export const CSSOCCER_NATIVE_FIELD_CONTRACT_SCHEMA =
  "cssoccer-native-field-contract@1";
export const CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256 =
  "6d21511c288f9553628079ffeaa4a6538d4eb1a8e4b36acb4f1d0c44de42a76e";
export const CSSOCCER_NATIVE_FIELD_FIXTURE_ID =
  "spain-argentina-full-match";
export const CSSOCCER_NATIVE_FIELD_COUNT = 412;

const FIELD_KEYS = Object.freeze([
  "id",
  "label",
  "sourceOwner",
  "meaning",
  "unit",
  "valueType",
]);
const SUPPORTED_VALUE_TYPES = new Set([
  "i8",
  "u8",
  "i16",
  "u16",
  "i32",
  "u32",
  "i64",
  "u64",
  "f32",
  "f64",
  "bool",
  "string",
  "null",
]);
const EXPECTED_DOMAIN_COUNTS = deepFreeze({
  ball: 17,
  camera: 10,
  clock: 10,
  lifecycle: 9,
  players: 352,
  rng: 2,
  rules: 8,
  score: 4,
});
const EXPECTED_PLAYER_IDS = deepFreeze(
  ["argentina", "spain"].flatMap((country) => (
    Array.from(
      { length: 11 },
      (_, index) => `${country}-player-${String(index + 1).padStart(2, "0")}`,
    )
  )),
);
const PLAYER_FIELD_COUNT = 16;
const FIELD_ROWS = [
  ["ball.in_air","Ball in air","EXTERNS.H ball_inair; BALL.CPP","Native airborne state.",null,"i32"],
  ["ball.in_goal","Ball in goal","EXTERNS.H ball_in_goal; BALL.CPP","Native goal-volume flag.",null,"u8"],
  ["ball.in_hands","Ball in hands","EXTERNS.H ball_in_hands; BALLINT.CPP","Native goalkeeper-hand flag.",null,"u8"],
  ["ball.last_touch","Ball last touch","EXTERNS.H last_touch; BALLINT.CPP","Native last-touch player index.",null,"i32"],
  ["ball.out_of_play","Ball out of play","EXTERNS.H ball_out_of_play; BALL.CPP","Native out-of-play countdown/state.",null,"i32"],
  ["ball.possession","Ball possession","EXTERNS.H ball_poss; BALLINT.CPP","Native possession player index.",null,"i32"],
  ["ball.speed","Ball speed","EXTERNS.H ball_speed; BALL.CPP","Native scalar ball speed.","native-speed","i32"],
  ["ball.spin_state","Ball spin state","EXTERNS.H spin_ball; BALL.CPP","Native spin-state counter.",null,"i32"],
  ["ball.spin_xy","Ball XY spin","EXTERNS.H ball_xyspin; BALL.CPP","Native horizontal ball spin.","native-spin","f32"],
  ["ball.spin_z","Ball Z spin","EXTERNS.H ball_zspin; BALL.CPP","Native vertical ball spin.","native-spin","f32"],
  ["ball.still","Ball still","EXTERNS.H ball_still; BALL.CPP","Native stationary-ball state.",null,"i32"],
  ["ball.x","Ball X","EXTERNS.H ballx; BALL.CPP","Native ball X position.","native-position","f32"],
  ["ball.x_displacement","Ball X displacement","EXTERNS.H ballxdis; BALL.CPP","Native per-tick ball X displacement.","native-position-per-tick","f32"],
  ["ball.y","Ball Y","EXTERNS.H bally; BALL.CPP","Native ball Y position.","native-position","f32"],
  ["ball.y_displacement","Ball Y displacement","EXTERNS.H ballydis; BALL.CPP","Native per-tick ball Y displacement.","native-position-per-tick","f32"],
  ["ball.z","Ball Z","EXTERNS.H ballz; BALL.CPP","Native ball Z position.","native-position","f32"],
  ["ball.z_displacement","Ball Z displacement","EXTERNS.H ballzdis; BALL.CPP","Native per-tick ball Z displacement.","native-position-per-tick","f32"],
  ["camera.distance","Camera distance","EXTERNS.H camera_dist; 3D_UPD2.CPP","Native camera distance.","native-position","f32"],
  ["camera.fixed","Camera fixed","3DENG.C camera_fixed","Native fixed-camera flag.",null,"u8"],
  ["camera.in_game","Camera in game","EXTERNS.H in_game; 3DENG.C","Native in-match rendering flag.",null,"u8"],
  ["camera.mode","Camera mode","EXTERNS.H camera; 3D_UPD2.CPP","Native camera mode.",null,"u8"],
  ["camera.target_x","Camera target X","3DENG.C tx","Native camera target X.","native-position","f32"],
  ["camera.target_y","Camera target Y","3DENG.C ty","Native camera target Y.","native-position","f32"],
  ["camera.target_z","Camera target Z","3DENG.C tz","Native camera target Z.","native-position","f32"],
  ["camera.x","Camera X","3DENG.C camera_x","Native camera X.","native-position","f32"],
  ["camera.y","Camera Y","3DENG.C camera_y","Native camera Y.","native-position","f32"],
  ["camera.z","Camera Z","3DENG.C camera_z","Native camera Z.","native-position","f32"],
  ["clock.clock_running","Clock running","FOOTBALL.CPP clock_running; RULES.CPP","Native match-clock running flag.",null,"u8"],
  ["clock.injury_time","Injury time","FOOTBALL.CPP injury_time","Native injury-time minutes.","game-minutes","i16"],
  ["clock.line_up","Line-up countdown","FOOTBALL.CPP line_up","Native line-up and kickoff countdown.","ticks","i16"],
  ["clock.logic_count","Logic count","EXTERNS.H logic_cnt; FOOTBALL.CPP","Native fixed-step logic counter.","ticks","i32"],
  ["clock.match_half","Match half","FOOTBALL.CPP match_half; RULES.CPP","Native lifecycle half/state value.",null,"u8"],
  ["clock.minutes","Match minutes","EXTERNS.H mtime.min; RULES.CPP","Native displayed game minutes.","game-minutes","u16"],
  ["clock.rolling_clock","Rolling clock","FOOTBALL.CPP rolling_clock; RULES.CPP","Native transition clock.","ticks","i32"],
  ["clock.seconds","Match seconds","EXTERNS.H mtime.sec; RULES.CPP","Native fractional displayed game seconds.","game-seconds","f32"],
  ["clock.stop_clock","Stop clock","RULES.CPP stop_clock","Native clock-stop flag.",null,"u8"],
  ["clock.time_factor","Time factor","EXTERNS.H time_factor; RULES.CPP","Native real-time match scaling factor.",null,"i32"],
  ["lifecycle.end_game","End game","FOOTBALL.CPP end_game","Native end-game flag.",null,"u8"],
  ["lifecycle.kick_off","Kick-off owner","FOOTBALL.CPP kick_off","Native kick-off ownership/state.",null,"u8"],
  ["lifecycle.kickoff","Kickoff state","FOOTBALL.CPP kickoff","Native kickoff state.",null,"u8"],
  ["lifecycle.match_factor_fixed","Match factor fixed","EXTERNS.H mf_fixed; FOOTBALL.CPP","Native fixed match-factor flag.",null,"u8"],
  ["lifecycle.team_a","Team A","FOOTBALL.CPP team_a","Native team-A fixture index.",null,"u8"],
  ["lifecycle.team_a_on","Team A on","EXTERNS.H team_a_on; ACTIONS.CPP","Native team-A active flag.",null,"u8"],
  ["lifecycle.team_b","Team B","FOOTBALL.CPP team_b","Native team-B fixture index.",null,"u8"],
  ["lifecycle.team_b_on","Team B on","EXTERNS.H team_b_on; ACTIONS.CPP","Native team-B active flag.",null,"u8"],
  ["lifecycle.watch","Watch state","EXTERNS.H watch; FOOTBALL.CPP","Native watch/timing state.",null,"u8"],
  ["players.argentina-player-01.action","argentina-player-01 Action","ANDYDEFS.H match_player.tm_act; teams[11]","Native player action.",null,"i16"],
  ["players.argentina-player-01.animation","argentina-player-01 Animation","ANDYDEFS.H match_player.tm_anim; teams[11]","Native animation identifier.",null,"u16"],
  ["players.argentina-player-01.animation_frame","argentina-player-01 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[11]","Native animation frame.",null,"f32"],
  ["players.argentina-player-01.ball_state","argentina-player-01 Ball state","ANDYDEFS.H match_player.ball_state; teams[11]","Native player-ball state.",null,"i16"],
  ["players.argentina-player-01.control","argentina-player-01 Control","ANDYDEFS.H match_player.control; teams[11]","Native player control state.",null,"u8"],
  ["players.argentina-player-01.face_direction","argentina-player-01 Face direction","ANDYDEFS.H match_player.face_dir; teams[11]","Native facing direction.",null,"i16"],
  ["players.argentina-player-01.native_player","argentina-player-01 Native player","ANDYDEFS.H match_player.tm_player; teams[11]","Native player identifier.",null,"i16"],
  ["players.argentina-player-01.on","argentina-player-01 On pitch","ANDYDEFS.H match_player.guy_on; teams[11]","Native active/on-pitch state.",null,"i16"],
  ["players.argentina-player-01.possession","argentina-player-01 Possession","ANDYDEFS.H match_player.tm_poss; teams[11]","Native player possession/action state.",null,"i16"],
  ["players.argentina-player-01.stable_id","argentina-player-01 Stable id","fixture argentina starter 1","Prepared stable starter identity.",null,"string"],
  ["players.argentina-player-01.x","argentina-player-01 X","ANDYDEFS.H match_player.tm_x; teams[11]","Native player X position.","native-position","f32"],
  ["players.argentina-player-01.x_displacement","argentina-player-01 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[11]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-01.y","argentina-player-01 Y","ANDYDEFS.H match_player.tm_y; teams[11]","Native player Y position.","native-position","f32"],
  ["players.argentina-player-01.y_displacement","argentina-player-01 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[11]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-01.z","argentina-player-01 Z","ANDYDEFS.H match_player.tm_z; teams[11]","Native player Z position.","native-position","f32"],
  ["players.argentina-player-01.z_displacement","argentina-player-01 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[11]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-02.action","argentina-player-02 Action","ANDYDEFS.H match_player.tm_act; teams[12]","Native player action.",null,"i16"],
  ["players.argentina-player-02.animation","argentina-player-02 Animation","ANDYDEFS.H match_player.tm_anim; teams[12]","Native animation identifier.",null,"u16"],
  ["players.argentina-player-02.animation_frame","argentina-player-02 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[12]","Native animation frame.",null,"f32"],
  ["players.argentina-player-02.ball_state","argentina-player-02 Ball state","ANDYDEFS.H match_player.ball_state; teams[12]","Native player-ball state.",null,"i16"],
  ["players.argentina-player-02.control","argentina-player-02 Control","ANDYDEFS.H match_player.control; teams[12]","Native player control state.",null,"u8"],
  ["players.argentina-player-02.face_direction","argentina-player-02 Face direction","ANDYDEFS.H match_player.face_dir; teams[12]","Native facing direction.",null,"i16"],
  ["players.argentina-player-02.native_player","argentina-player-02 Native player","ANDYDEFS.H match_player.tm_player; teams[12]","Native player identifier.",null,"i16"],
  ["players.argentina-player-02.on","argentina-player-02 On pitch","ANDYDEFS.H match_player.guy_on; teams[12]","Native active/on-pitch state.",null,"i16"],
  ["players.argentina-player-02.possession","argentina-player-02 Possession","ANDYDEFS.H match_player.tm_poss; teams[12]","Native player possession/action state.",null,"i16"],
  ["players.argentina-player-02.stable_id","argentina-player-02 Stable id","fixture argentina starter 2","Prepared stable starter identity.",null,"string"],
  ["players.argentina-player-02.x","argentina-player-02 X","ANDYDEFS.H match_player.tm_x; teams[12]","Native player X position.","native-position","f32"],
  ["players.argentina-player-02.x_displacement","argentina-player-02 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[12]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-02.y","argentina-player-02 Y","ANDYDEFS.H match_player.tm_y; teams[12]","Native player Y position.","native-position","f32"],
  ["players.argentina-player-02.y_displacement","argentina-player-02 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[12]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-02.z","argentina-player-02 Z","ANDYDEFS.H match_player.tm_z; teams[12]","Native player Z position.","native-position","f32"],
  ["players.argentina-player-02.z_displacement","argentina-player-02 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[12]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-03.action","argentina-player-03 Action","ANDYDEFS.H match_player.tm_act; teams[13]","Native player action.",null,"i16"],
  ["players.argentina-player-03.animation","argentina-player-03 Animation","ANDYDEFS.H match_player.tm_anim; teams[13]","Native animation identifier.",null,"u16"],
  ["players.argentina-player-03.animation_frame","argentina-player-03 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[13]","Native animation frame.",null,"f32"],
  ["players.argentina-player-03.ball_state","argentina-player-03 Ball state","ANDYDEFS.H match_player.ball_state; teams[13]","Native player-ball state.",null,"i16"],
  ["players.argentina-player-03.control","argentina-player-03 Control","ANDYDEFS.H match_player.control; teams[13]","Native player control state.",null,"u8"],
  ["players.argentina-player-03.face_direction","argentina-player-03 Face direction","ANDYDEFS.H match_player.face_dir; teams[13]","Native facing direction.",null,"i16"],
  ["players.argentina-player-03.native_player","argentina-player-03 Native player","ANDYDEFS.H match_player.tm_player; teams[13]","Native player identifier.",null,"i16"],
  ["players.argentina-player-03.on","argentina-player-03 On pitch","ANDYDEFS.H match_player.guy_on; teams[13]","Native active/on-pitch state.",null,"i16"],
  ["players.argentina-player-03.possession","argentina-player-03 Possession","ANDYDEFS.H match_player.tm_poss; teams[13]","Native player possession/action state.",null,"i16"],
  ["players.argentina-player-03.stable_id","argentina-player-03 Stable id","fixture argentina starter 3","Prepared stable starter identity.",null,"string"],
  ["players.argentina-player-03.x","argentina-player-03 X","ANDYDEFS.H match_player.tm_x; teams[13]","Native player X position.","native-position","f32"],
  ["players.argentina-player-03.x_displacement","argentina-player-03 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[13]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-03.y","argentina-player-03 Y","ANDYDEFS.H match_player.tm_y; teams[13]","Native player Y position.","native-position","f32"],
  ["players.argentina-player-03.y_displacement","argentina-player-03 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[13]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-03.z","argentina-player-03 Z","ANDYDEFS.H match_player.tm_z; teams[13]","Native player Z position.","native-position","f32"],
  ["players.argentina-player-03.z_displacement","argentina-player-03 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[13]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-04.action","argentina-player-04 Action","ANDYDEFS.H match_player.tm_act; teams[14]","Native player action.",null,"i16"],
  ["players.argentina-player-04.animation","argentina-player-04 Animation","ANDYDEFS.H match_player.tm_anim; teams[14]","Native animation identifier.",null,"u16"],
  ["players.argentina-player-04.animation_frame","argentina-player-04 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[14]","Native animation frame.",null,"f32"],
  ["players.argentina-player-04.ball_state","argentina-player-04 Ball state","ANDYDEFS.H match_player.ball_state; teams[14]","Native player-ball state.",null,"i16"],
  ["players.argentina-player-04.control","argentina-player-04 Control","ANDYDEFS.H match_player.control; teams[14]","Native player control state.",null,"u8"],
  ["players.argentina-player-04.face_direction","argentina-player-04 Face direction","ANDYDEFS.H match_player.face_dir; teams[14]","Native facing direction.",null,"i16"],
  ["players.argentina-player-04.native_player","argentina-player-04 Native player","ANDYDEFS.H match_player.tm_player; teams[14]","Native player identifier.",null,"i16"],
  ["players.argentina-player-04.on","argentina-player-04 On pitch","ANDYDEFS.H match_player.guy_on; teams[14]","Native active/on-pitch state.",null,"i16"],
  ["players.argentina-player-04.possession","argentina-player-04 Possession","ANDYDEFS.H match_player.tm_poss; teams[14]","Native player possession/action state.",null,"i16"],
  ["players.argentina-player-04.stable_id","argentina-player-04 Stable id","fixture argentina starter 4","Prepared stable starter identity.",null,"string"],
  ["players.argentina-player-04.x","argentina-player-04 X","ANDYDEFS.H match_player.tm_x; teams[14]","Native player X position.","native-position","f32"],
  ["players.argentina-player-04.x_displacement","argentina-player-04 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[14]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-04.y","argentina-player-04 Y","ANDYDEFS.H match_player.tm_y; teams[14]","Native player Y position.","native-position","f32"],
  ["players.argentina-player-04.y_displacement","argentina-player-04 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[14]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-04.z","argentina-player-04 Z","ANDYDEFS.H match_player.tm_z; teams[14]","Native player Z position.","native-position","f32"],
  ["players.argentina-player-04.z_displacement","argentina-player-04 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[14]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-05.action","argentina-player-05 Action","ANDYDEFS.H match_player.tm_act; teams[15]","Native player action.",null,"i16"],
  ["players.argentina-player-05.animation","argentina-player-05 Animation","ANDYDEFS.H match_player.tm_anim; teams[15]","Native animation identifier.",null,"u16"],
  ["players.argentina-player-05.animation_frame","argentina-player-05 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[15]","Native animation frame.",null,"f32"],
  ["players.argentina-player-05.ball_state","argentina-player-05 Ball state","ANDYDEFS.H match_player.ball_state; teams[15]","Native player-ball state.",null,"i16"],
  ["players.argentina-player-05.control","argentina-player-05 Control","ANDYDEFS.H match_player.control; teams[15]","Native player control state.",null,"u8"],
  ["players.argentina-player-05.face_direction","argentina-player-05 Face direction","ANDYDEFS.H match_player.face_dir; teams[15]","Native facing direction.",null,"i16"],
  ["players.argentina-player-05.native_player","argentina-player-05 Native player","ANDYDEFS.H match_player.tm_player; teams[15]","Native player identifier.",null,"i16"],
  ["players.argentina-player-05.on","argentina-player-05 On pitch","ANDYDEFS.H match_player.guy_on; teams[15]","Native active/on-pitch state.",null,"i16"],
  ["players.argentina-player-05.possession","argentina-player-05 Possession","ANDYDEFS.H match_player.tm_poss; teams[15]","Native player possession/action state.",null,"i16"],
  ["players.argentina-player-05.stable_id","argentina-player-05 Stable id","fixture argentina starter 5","Prepared stable starter identity.",null,"string"],
  ["players.argentina-player-05.x","argentina-player-05 X","ANDYDEFS.H match_player.tm_x; teams[15]","Native player X position.","native-position","f32"],
  ["players.argentina-player-05.x_displacement","argentina-player-05 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[15]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-05.y","argentina-player-05 Y","ANDYDEFS.H match_player.tm_y; teams[15]","Native player Y position.","native-position","f32"],
  ["players.argentina-player-05.y_displacement","argentina-player-05 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[15]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-05.z","argentina-player-05 Z","ANDYDEFS.H match_player.tm_z; teams[15]","Native player Z position.","native-position","f32"],
  ["players.argentina-player-05.z_displacement","argentina-player-05 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[15]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-06.action","argentina-player-06 Action","ANDYDEFS.H match_player.tm_act; teams[16]","Native player action.",null,"i16"],
  ["players.argentina-player-06.animation","argentina-player-06 Animation","ANDYDEFS.H match_player.tm_anim; teams[16]","Native animation identifier.",null,"u16"],
  ["players.argentina-player-06.animation_frame","argentina-player-06 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[16]","Native animation frame.",null,"f32"],
  ["players.argentina-player-06.ball_state","argentina-player-06 Ball state","ANDYDEFS.H match_player.ball_state; teams[16]","Native player-ball state.",null,"i16"],
  ["players.argentina-player-06.control","argentina-player-06 Control","ANDYDEFS.H match_player.control; teams[16]","Native player control state.",null,"u8"],
  ["players.argentina-player-06.face_direction","argentina-player-06 Face direction","ANDYDEFS.H match_player.face_dir; teams[16]","Native facing direction.",null,"i16"],
  ["players.argentina-player-06.native_player","argentina-player-06 Native player","ANDYDEFS.H match_player.tm_player; teams[16]","Native player identifier.",null,"i16"],
  ["players.argentina-player-06.on","argentina-player-06 On pitch","ANDYDEFS.H match_player.guy_on; teams[16]","Native active/on-pitch state.",null,"i16"],
  ["players.argentina-player-06.possession","argentina-player-06 Possession","ANDYDEFS.H match_player.tm_poss; teams[16]","Native player possession/action state.",null,"i16"],
  ["players.argentina-player-06.stable_id","argentina-player-06 Stable id","fixture argentina starter 6","Prepared stable starter identity.",null,"string"],
  ["players.argentina-player-06.x","argentina-player-06 X","ANDYDEFS.H match_player.tm_x; teams[16]","Native player X position.","native-position","f32"],
  ["players.argentina-player-06.x_displacement","argentina-player-06 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[16]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-06.y","argentina-player-06 Y","ANDYDEFS.H match_player.tm_y; teams[16]","Native player Y position.","native-position","f32"],
  ["players.argentina-player-06.y_displacement","argentina-player-06 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[16]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-06.z","argentina-player-06 Z","ANDYDEFS.H match_player.tm_z; teams[16]","Native player Z position.","native-position","f32"],
  ["players.argentina-player-06.z_displacement","argentina-player-06 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[16]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-07.action","argentina-player-07 Action","ANDYDEFS.H match_player.tm_act; teams[17]","Native player action.",null,"i16"],
  ["players.argentina-player-07.animation","argentina-player-07 Animation","ANDYDEFS.H match_player.tm_anim; teams[17]","Native animation identifier.",null,"u16"],
  ["players.argentina-player-07.animation_frame","argentina-player-07 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[17]","Native animation frame.",null,"f32"],
  ["players.argentina-player-07.ball_state","argentina-player-07 Ball state","ANDYDEFS.H match_player.ball_state; teams[17]","Native player-ball state.",null,"i16"],
  ["players.argentina-player-07.control","argentina-player-07 Control","ANDYDEFS.H match_player.control; teams[17]","Native player control state.",null,"u8"],
  ["players.argentina-player-07.face_direction","argentina-player-07 Face direction","ANDYDEFS.H match_player.face_dir; teams[17]","Native facing direction.",null,"i16"],
  ["players.argentina-player-07.native_player","argentina-player-07 Native player","ANDYDEFS.H match_player.tm_player; teams[17]","Native player identifier.",null,"i16"],
  ["players.argentina-player-07.on","argentina-player-07 On pitch","ANDYDEFS.H match_player.guy_on; teams[17]","Native active/on-pitch state.",null,"i16"],
  ["players.argentina-player-07.possession","argentina-player-07 Possession","ANDYDEFS.H match_player.tm_poss; teams[17]","Native player possession/action state.",null,"i16"],
  ["players.argentina-player-07.stable_id","argentina-player-07 Stable id","fixture argentina starter 7","Prepared stable starter identity.",null,"string"],
  ["players.argentina-player-07.x","argentina-player-07 X","ANDYDEFS.H match_player.tm_x; teams[17]","Native player X position.","native-position","f32"],
  ["players.argentina-player-07.x_displacement","argentina-player-07 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[17]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-07.y","argentina-player-07 Y","ANDYDEFS.H match_player.tm_y; teams[17]","Native player Y position.","native-position","f32"],
  ["players.argentina-player-07.y_displacement","argentina-player-07 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[17]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-07.z","argentina-player-07 Z","ANDYDEFS.H match_player.tm_z; teams[17]","Native player Z position.","native-position","f32"],
  ["players.argentina-player-07.z_displacement","argentina-player-07 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[17]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-08.action","argentina-player-08 Action","ANDYDEFS.H match_player.tm_act; teams[18]","Native player action.",null,"i16"],
  ["players.argentina-player-08.animation","argentina-player-08 Animation","ANDYDEFS.H match_player.tm_anim; teams[18]","Native animation identifier.",null,"u16"],
  ["players.argentina-player-08.animation_frame","argentina-player-08 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[18]","Native animation frame.",null,"f32"],
  ["players.argentina-player-08.ball_state","argentina-player-08 Ball state","ANDYDEFS.H match_player.ball_state; teams[18]","Native player-ball state.",null,"i16"],
  ["players.argentina-player-08.control","argentina-player-08 Control","ANDYDEFS.H match_player.control; teams[18]","Native player control state.",null,"u8"],
  ["players.argentina-player-08.face_direction","argentina-player-08 Face direction","ANDYDEFS.H match_player.face_dir; teams[18]","Native facing direction.",null,"i16"],
  ["players.argentina-player-08.native_player","argentina-player-08 Native player","ANDYDEFS.H match_player.tm_player; teams[18]","Native player identifier.",null,"i16"],
  ["players.argentina-player-08.on","argentina-player-08 On pitch","ANDYDEFS.H match_player.guy_on; teams[18]","Native active/on-pitch state.",null,"i16"],
  ["players.argentina-player-08.possession","argentina-player-08 Possession","ANDYDEFS.H match_player.tm_poss; teams[18]","Native player possession/action state.",null,"i16"],
  ["players.argentina-player-08.stable_id","argentina-player-08 Stable id","fixture argentina starter 8","Prepared stable starter identity.",null,"string"],
  ["players.argentina-player-08.x","argentina-player-08 X","ANDYDEFS.H match_player.tm_x; teams[18]","Native player X position.","native-position","f32"],
  ["players.argentina-player-08.x_displacement","argentina-player-08 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[18]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-08.y","argentina-player-08 Y","ANDYDEFS.H match_player.tm_y; teams[18]","Native player Y position.","native-position","f32"],
  ["players.argentina-player-08.y_displacement","argentina-player-08 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[18]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-08.z","argentina-player-08 Z","ANDYDEFS.H match_player.tm_z; teams[18]","Native player Z position.","native-position","f32"],
  ["players.argentina-player-08.z_displacement","argentina-player-08 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[18]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-09.action","argentina-player-09 Action","ANDYDEFS.H match_player.tm_act; teams[19]","Native player action.",null,"i16"],
  ["players.argentina-player-09.animation","argentina-player-09 Animation","ANDYDEFS.H match_player.tm_anim; teams[19]","Native animation identifier.",null,"u16"],
  ["players.argentina-player-09.animation_frame","argentina-player-09 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[19]","Native animation frame.",null,"f32"],
  ["players.argentina-player-09.ball_state","argentina-player-09 Ball state","ANDYDEFS.H match_player.ball_state; teams[19]","Native player-ball state.",null,"i16"],
  ["players.argentina-player-09.control","argentina-player-09 Control","ANDYDEFS.H match_player.control; teams[19]","Native player control state.",null,"u8"],
  ["players.argentina-player-09.face_direction","argentina-player-09 Face direction","ANDYDEFS.H match_player.face_dir; teams[19]","Native facing direction.",null,"i16"],
  ["players.argentina-player-09.native_player","argentina-player-09 Native player","ANDYDEFS.H match_player.tm_player; teams[19]","Native player identifier.",null,"i16"],
  ["players.argentina-player-09.on","argentina-player-09 On pitch","ANDYDEFS.H match_player.guy_on; teams[19]","Native active/on-pitch state.",null,"i16"],
  ["players.argentina-player-09.possession","argentina-player-09 Possession","ANDYDEFS.H match_player.tm_poss; teams[19]","Native player possession/action state.",null,"i16"],
  ["players.argentina-player-09.stable_id","argentina-player-09 Stable id","fixture argentina starter 9","Prepared stable starter identity.",null,"string"],
  ["players.argentina-player-09.x","argentina-player-09 X","ANDYDEFS.H match_player.tm_x; teams[19]","Native player X position.","native-position","f32"],
  ["players.argentina-player-09.x_displacement","argentina-player-09 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[19]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-09.y","argentina-player-09 Y","ANDYDEFS.H match_player.tm_y; teams[19]","Native player Y position.","native-position","f32"],
  ["players.argentina-player-09.y_displacement","argentina-player-09 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[19]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-09.z","argentina-player-09 Z","ANDYDEFS.H match_player.tm_z; teams[19]","Native player Z position.","native-position","f32"],
  ["players.argentina-player-09.z_displacement","argentina-player-09 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[19]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-10.action","argentina-player-10 Action","ANDYDEFS.H match_player.tm_act; teams[20]","Native player action.",null,"i16"],
  ["players.argentina-player-10.animation","argentina-player-10 Animation","ANDYDEFS.H match_player.tm_anim; teams[20]","Native animation identifier.",null,"u16"],
  ["players.argentina-player-10.animation_frame","argentina-player-10 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[20]","Native animation frame.",null,"f32"],
  ["players.argentina-player-10.ball_state","argentina-player-10 Ball state","ANDYDEFS.H match_player.ball_state; teams[20]","Native player-ball state.",null,"i16"],
  ["players.argentina-player-10.control","argentina-player-10 Control","ANDYDEFS.H match_player.control; teams[20]","Native player control state.",null,"u8"],
  ["players.argentina-player-10.face_direction","argentina-player-10 Face direction","ANDYDEFS.H match_player.face_dir; teams[20]","Native facing direction.",null,"i16"],
  ["players.argentina-player-10.native_player","argentina-player-10 Native player","ANDYDEFS.H match_player.tm_player; teams[20]","Native player identifier.",null,"i16"],
  ["players.argentina-player-10.on","argentina-player-10 On pitch","ANDYDEFS.H match_player.guy_on; teams[20]","Native active/on-pitch state.",null,"i16"],
  ["players.argentina-player-10.possession","argentina-player-10 Possession","ANDYDEFS.H match_player.tm_poss; teams[20]","Native player possession/action state.",null,"i16"],
  ["players.argentina-player-10.stable_id","argentina-player-10 Stable id","fixture argentina starter 10","Prepared stable starter identity.",null,"string"],
  ["players.argentina-player-10.x","argentina-player-10 X","ANDYDEFS.H match_player.tm_x; teams[20]","Native player X position.","native-position","f32"],
  ["players.argentina-player-10.x_displacement","argentina-player-10 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[20]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-10.y","argentina-player-10 Y","ANDYDEFS.H match_player.tm_y; teams[20]","Native player Y position.","native-position","f32"],
  ["players.argentina-player-10.y_displacement","argentina-player-10 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[20]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-10.z","argentina-player-10 Z","ANDYDEFS.H match_player.tm_z; teams[20]","Native player Z position.","native-position","f32"],
  ["players.argentina-player-10.z_displacement","argentina-player-10 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[20]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-11.action","argentina-player-11 Action","ANDYDEFS.H match_player.tm_act; teams[21]","Native player action.",null,"i16"],
  ["players.argentina-player-11.animation","argentina-player-11 Animation","ANDYDEFS.H match_player.tm_anim; teams[21]","Native animation identifier.",null,"u16"],
  ["players.argentina-player-11.animation_frame","argentina-player-11 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[21]","Native animation frame.",null,"f32"],
  ["players.argentina-player-11.ball_state","argentina-player-11 Ball state","ANDYDEFS.H match_player.ball_state; teams[21]","Native player-ball state.",null,"i16"],
  ["players.argentina-player-11.control","argentina-player-11 Control","ANDYDEFS.H match_player.control; teams[21]","Native player control state.",null,"u8"],
  ["players.argentina-player-11.face_direction","argentina-player-11 Face direction","ANDYDEFS.H match_player.face_dir; teams[21]","Native facing direction.",null,"i16"],
  ["players.argentina-player-11.native_player","argentina-player-11 Native player","ANDYDEFS.H match_player.tm_player; teams[21]","Native player identifier.",null,"i16"],
  ["players.argentina-player-11.on","argentina-player-11 On pitch","ANDYDEFS.H match_player.guy_on; teams[21]","Native active/on-pitch state.",null,"i16"],
  ["players.argentina-player-11.possession","argentina-player-11 Possession","ANDYDEFS.H match_player.tm_poss; teams[21]","Native player possession/action state.",null,"i16"],
  ["players.argentina-player-11.stable_id","argentina-player-11 Stable id","fixture argentina starter 11","Prepared stable starter identity.",null,"string"],
  ["players.argentina-player-11.x","argentina-player-11 X","ANDYDEFS.H match_player.tm_x; teams[21]","Native player X position.","native-position","f32"],
  ["players.argentina-player-11.x_displacement","argentina-player-11 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[21]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-11.y","argentina-player-11 Y","ANDYDEFS.H match_player.tm_y; teams[21]","Native player Y position.","native-position","f32"],
  ["players.argentina-player-11.y_displacement","argentina-player-11 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[21]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.argentina-player-11.z","argentina-player-11 Z","ANDYDEFS.H match_player.tm_z; teams[21]","Native player Z position.","native-position","f32"],
  ["players.argentina-player-11.z_displacement","argentina-player-11 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[21]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.spain-player-01.action","spain-player-01 Action","ANDYDEFS.H match_player.tm_act; teams[0]","Native player action.",null,"i16"],
  ["players.spain-player-01.animation","spain-player-01 Animation","ANDYDEFS.H match_player.tm_anim; teams[0]","Native animation identifier.",null,"u16"],
  ["players.spain-player-01.animation_frame","spain-player-01 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[0]","Native animation frame.",null,"f32"],
  ["players.spain-player-01.ball_state","spain-player-01 Ball state","ANDYDEFS.H match_player.ball_state; teams[0]","Native player-ball state.",null,"i16"],
  ["players.spain-player-01.control","spain-player-01 Control","ANDYDEFS.H match_player.control; teams[0]","Native player control state.",null,"u8"],
  ["players.spain-player-01.face_direction","spain-player-01 Face direction","ANDYDEFS.H match_player.face_dir; teams[0]","Native facing direction.",null,"i16"],
  ["players.spain-player-01.native_player","spain-player-01 Native player","ANDYDEFS.H match_player.tm_player; teams[0]","Native player identifier.",null,"i16"],
  ["players.spain-player-01.on","spain-player-01 On pitch","ANDYDEFS.H match_player.guy_on; teams[0]","Native active/on-pitch state.",null,"i16"],
  ["players.spain-player-01.possession","spain-player-01 Possession","ANDYDEFS.H match_player.tm_poss; teams[0]","Native player possession/action state.",null,"i16"],
  ["players.spain-player-01.stable_id","spain-player-01 Stable id","fixture spain starter 1","Prepared stable starter identity.",null,"string"],
  ["players.spain-player-01.x","spain-player-01 X","ANDYDEFS.H match_player.tm_x; teams[0]","Native player X position.","native-position","f32"],
  ["players.spain-player-01.x_displacement","spain-player-01 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[0]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.spain-player-01.y","spain-player-01 Y","ANDYDEFS.H match_player.tm_y; teams[0]","Native player Y position.","native-position","f32"],
  ["players.spain-player-01.y_displacement","spain-player-01 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[0]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.spain-player-01.z","spain-player-01 Z","ANDYDEFS.H match_player.tm_z; teams[0]","Native player Z position.","native-position","f32"],
  ["players.spain-player-01.z_displacement","spain-player-01 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[0]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.spain-player-02.action","spain-player-02 Action","ANDYDEFS.H match_player.tm_act; teams[1]","Native player action.",null,"i16"],
  ["players.spain-player-02.animation","spain-player-02 Animation","ANDYDEFS.H match_player.tm_anim; teams[1]","Native animation identifier.",null,"u16"],
  ["players.spain-player-02.animation_frame","spain-player-02 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[1]","Native animation frame.",null,"f32"],
  ["players.spain-player-02.ball_state","spain-player-02 Ball state","ANDYDEFS.H match_player.ball_state; teams[1]","Native player-ball state.",null,"i16"],
  ["players.spain-player-02.control","spain-player-02 Control","ANDYDEFS.H match_player.control; teams[1]","Native player control state.",null,"u8"],
  ["players.spain-player-02.face_direction","spain-player-02 Face direction","ANDYDEFS.H match_player.face_dir; teams[1]","Native facing direction.",null,"i16"],
  ["players.spain-player-02.native_player","spain-player-02 Native player","ANDYDEFS.H match_player.tm_player; teams[1]","Native player identifier.",null,"i16"],
  ["players.spain-player-02.on","spain-player-02 On pitch","ANDYDEFS.H match_player.guy_on; teams[1]","Native active/on-pitch state.",null,"i16"],
  ["players.spain-player-02.possession","spain-player-02 Possession","ANDYDEFS.H match_player.tm_poss; teams[1]","Native player possession/action state.",null,"i16"],
  ["players.spain-player-02.stable_id","spain-player-02 Stable id","fixture spain starter 2","Prepared stable starter identity.",null,"string"],
  ["players.spain-player-02.x","spain-player-02 X","ANDYDEFS.H match_player.tm_x; teams[1]","Native player X position.","native-position","f32"],
  ["players.spain-player-02.x_displacement","spain-player-02 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[1]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.spain-player-02.y","spain-player-02 Y","ANDYDEFS.H match_player.tm_y; teams[1]","Native player Y position.","native-position","f32"],
  ["players.spain-player-02.y_displacement","spain-player-02 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[1]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.spain-player-02.z","spain-player-02 Z","ANDYDEFS.H match_player.tm_z; teams[1]","Native player Z position.","native-position","f32"],
  ["players.spain-player-02.z_displacement","spain-player-02 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[1]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.spain-player-03.action","spain-player-03 Action","ANDYDEFS.H match_player.tm_act; teams[2]","Native player action.",null,"i16"],
  ["players.spain-player-03.animation","spain-player-03 Animation","ANDYDEFS.H match_player.tm_anim; teams[2]","Native animation identifier.",null,"u16"],
  ["players.spain-player-03.animation_frame","spain-player-03 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[2]","Native animation frame.",null,"f32"],
  ["players.spain-player-03.ball_state","spain-player-03 Ball state","ANDYDEFS.H match_player.ball_state; teams[2]","Native player-ball state.",null,"i16"],
  ["players.spain-player-03.control","spain-player-03 Control","ANDYDEFS.H match_player.control; teams[2]","Native player control state.",null,"u8"],
  ["players.spain-player-03.face_direction","spain-player-03 Face direction","ANDYDEFS.H match_player.face_dir; teams[2]","Native facing direction.",null,"i16"],
  ["players.spain-player-03.native_player","spain-player-03 Native player","ANDYDEFS.H match_player.tm_player; teams[2]","Native player identifier.",null,"i16"],
  ["players.spain-player-03.on","spain-player-03 On pitch","ANDYDEFS.H match_player.guy_on; teams[2]","Native active/on-pitch state.",null,"i16"],
  ["players.spain-player-03.possession","spain-player-03 Possession","ANDYDEFS.H match_player.tm_poss; teams[2]","Native player possession/action state.",null,"i16"],
  ["players.spain-player-03.stable_id","spain-player-03 Stable id","fixture spain starter 3","Prepared stable starter identity.",null,"string"],
  ["players.spain-player-03.x","spain-player-03 X","ANDYDEFS.H match_player.tm_x; teams[2]","Native player X position.","native-position","f32"],
  ["players.spain-player-03.x_displacement","spain-player-03 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[2]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.spain-player-03.y","spain-player-03 Y","ANDYDEFS.H match_player.tm_y; teams[2]","Native player Y position.","native-position","f32"],
  ["players.spain-player-03.y_displacement","spain-player-03 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[2]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.spain-player-03.z","spain-player-03 Z","ANDYDEFS.H match_player.tm_z; teams[2]","Native player Z position.","native-position","f32"],
  ["players.spain-player-03.z_displacement","spain-player-03 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[2]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.spain-player-04.action","spain-player-04 Action","ANDYDEFS.H match_player.tm_act; teams[3]","Native player action.",null,"i16"],
  ["players.spain-player-04.animation","spain-player-04 Animation","ANDYDEFS.H match_player.tm_anim; teams[3]","Native animation identifier.",null,"u16"],
  ["players.spain-player-04.animation_frame","spain-player-04 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[3]","Native animation frame.",null,"f32"],
  ["players.spain-player-04.ball_state","spain-player-04 Ball state","ANDYDEFS.H match_player.ball_state; teams[3]","Native player-ball state.",null,"i16"],
  ["players.spain-player-04.control","spain-player-04 Control","ANDYDEFS.H match_player.control; teams[3]","Native player control state.",null,"u8"],
  ["players.spain-player-04.face_direction","spain-player-04 Face direction","ANDYDEFS.H match_player.face_dir; teams[3]","Native facing direction.",null,"i16"],
  ["players.spain-player-04.native_player","spain-player-04 Native player","ANDYDEFS.H match_player.tm_player; teams[3]","Native player identifier.",null,"i16"],
  ["players.spain-player-04.on","spain-player-04 On pitch","ANDYDEFS.H match_player.guy_on; teams[3]","Native active/on-pitch state.",null,"i16"],
  ["players.spain-player-04.possession","spain-player-04 Possession","ANDYDEFS.H match_player.tm_poss; teams[3]","Native player possession/action state.",null,"i16"],
  ["players.spain-player-04.stable_id","spain-player-04 Stable id","fixture spain starter 4","Prepared stable starter identity.",null,"string"],
  ["players.spain-player-04.x","spain-player-04 X","ANDYDEFS.H match_player.tm_x; teams[3]","Native player X position.","native-position","f32"],
  ["players.spain-player-04.x_displacement","spain-player-04 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[3]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.spain-player-04.y","spain-player-04 Y","ANDYDEFS.H match_player.tm_y; teams[3]","Native player Y position.","native-position","f32"],
  ["players.spain-player-04.y_displacement","spain-player-04 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[3]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.spain-player-04.z","spain-player-04 Z","ANDYDEFS.H match_player.tm_z; teams[3]","Native player Z position.","native-position","f32"],
  ["players.spain-player-04.z_displacement","spain-player-04 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[3]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.spain-player-05.action","spain-player-05 Action","ANDYDEFS.H match_player.tm_act; teams[4]","Native player action.",null,"i16"],
  ["players.spain-player-05.animation","spain-player-05 Animation","ANDYDEFS.H match_player.tm_anim; teams[4]","Native animation identifier.",null,"u16"],
  ["players.spain-player-05.animation_frame","spain-player-05 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[4]","Native animation frame.",null,"f32"],
  ["players.spain-player-05.ball_state","spain-player-05 Ball state","ANDYDEFS.H match_player.ball_state; teams[4]","Native player-ball state.",null,"i16"],
  ["players.spain-player-05.control","spain-player-05 Control","ANDYDEFS.H match_player.control; teams[4]","Native player control state.",null,"u8"],
  ["players.spain-player-05.face_direction","spain-player-05 Face direction","ANDYDEFS.H match_player.face_dir; teams[4]","Native facing direction.",null,"i16"],
  ["players.spain-player-05.native_player","spain-player-05 Native player","ANDYDEFS.H match_player.tm_player; teams[4]","Native player identifier.",null,"i16"],
  ["players.spain-player-05.on","spain-player-05 On pitch","ANDYDEFS.H match_player.guy_on; teams[4]","Native active/on-pitch state.",null,"i16"],
  ["players.spain-player-05.possession","spain-player-05 Possession","ANDYDEFS.H match_player.tm_poss; teams[4]","Native player possession/action state.",null,"i16"],
  ["players.spain-player-05.stable_id","spain-player-05 Stable id","fixture spain starter 5","Prepared stable starter identity.",null,"string"],
  ["players.spain-player-05.x","spain-player-05 X","ANDYDEFS.H match_player.tm_x; teams[4]","Native player X position.","native-position","f32"],
  ["players.spain-player-05.x_displacement","spain-player-05 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[4]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.spain-player-05.y","spain-player-05 Y","ANDYDEFS.H match_player.tm_y; teams[4]","Native player Y position.","native-position","f32"],
  ["players.spain-player-05.y_displacement","spain-player-05 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[4]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.spain-player-05.z","spain-player-05 Z","ANDYDEFS.H match_player.tm_z; teams[4]","Native player Z position.","native-position","f32"],
  ["players.spain-player-05.z_displacement","spain-player-05 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[4]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.spain-player-06.action","spain-player-06 Action","ANDYDEFS.H match_player.tm_act; teams[5]","Native player action.",null,"i16"],
  ["players.spain-player-06.animation","spain-player-06 Animation","ANDYDEFS.H match_player.tm_anim; teams[5]","Native animation identifier.",null,"u16"],
  ["players.spain-player-06.animation_frame","spain-player-06 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[5]","Native animation frame.",null,"f32"],
  ["players.spain-player-06.ball_state","spain-player-06 Ball state","ANDYDEFS.H match_player.ball_state; teams[5]","Native player-ball state.",null,"i16"],
  ["players.spain-player-06.control","spain-player-06 Control","ANDYDEFS.H match_player.control; teams[5]","Native player control state.",null,"u8"],
  ["players.spain-player-06.face_direction","spain-player-06 Face direction","ANDYDEFS.H match_player.face_dir; teams[5]","Native facing direction.",null,"i16"],
  ["players.spain-player-06.native_player","spain-player-06 Native player","ANDYDEFS.H match_player.tm_player; teams[5]","Native player identifier.",null,"i16"],
  ["players.spain-player-06.on","spain-player-06 On pitch","ANDYDEFS.H match_player.guy_on; teams[5]","Native active/on-pitch state.",null,"i16"],
  ["players.spain-player-06.possession","spain-player-06 Possession","ANDYDEFS.H match_player.tm_poss; teams[5]","Native player possession/action state.",null,"i16"],
  ["players.spain-player-06.stable_id","spain-player-06 Stable id","fixture spain starter 6","Prepared stable starter identity.",null,"string"],
  ["players.spain-player-06.x","spain-player-06 X","ANDYDEFS.H match_player.tm_x; teams[5]","Native player X position.","native-position","f32"],
  ["players.spain-player-06.x_displacement","spain-player-06 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[5]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.spain-player-06.y","spain-player-06 Y","ANDYDEFS.H match_player.tm_y; teams[5]","Native player Y position.","native-position","f32"],
  ["players.spain-player-06.y_displacement","spain-player-06 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[5]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.spain-player-06.z","spain-player-06 Z","ANDYDEFS.H match_player.tm_z; teams[5]","Native player Z position.","native-position","f32"],
  ["players.spain-player-06.z_displacement","spain-player-06 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[5]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.spain-player-07.action","spain-player-07 Action","ANDYDEFS.H match_player.tm_act; teams[6]","Native player action.",null,"i16"],
  ["players.spain-player-07.animation","spain-player-07 Animation","ANDYDEFS.H match_player.tm_anim; teams[6]","Native animation identifier.",null,"u16"],
  ["players.spain-player-07.animation_frame","spain-player-07 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[6]","Native animation frame.",null,"f32"],
  ["players.spain-player-07.ball_state","spain-player-07 Ball state","ANDYDEFS.H match_player.ball_state; teams[6]","Native player-ball state.",null,"i16"],
  ["players.spain-player-07.control","spain-player-07 Control","ANDYDEFS.H match_player.control; teams[6]","Native player control state.",null,"u8"],
  ["players.spain-player-07.face_direction","spain-player-07 Face direction","ANDYDEFS.H match_player.face_dir; teams[6]","Native facing direction.",null,"i16"],
  ["players.spain-player-07.native_player","spain-player-07 Native player","ANDYDEFS.H match_player.tm_player; teams[6]","Native player identifier.",null,"i16"],
  ["players.spain-player-07.on","spain-player-07 On pitch","ANDYDEFS.H match_player.guy_on; teams[6]","Native active/on-pitch state.",null,"i16"],
  ["players.spain-player-07.possession","spain-player-07 Possession","ANDYDEFS.H match_player.tm_poss; teams[6]","Native player possession/action state.",null,"i16"],
  ["players.spain-player-07.stable_id","spain-player-07 Stable id","fixture spain starter 7","Prepared stable starter identity.",null,"string"],
  ["players.spain-player-07.x","spain-player-07 X","ANDYDEFS.H match_player.tm_x; teams[6]","Native player X position.","native-position","f32"],
  ["players.spain-player-07.x_displacement","spain-player-07 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[6]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.spain-player-07.y","spain-player-07 Y","ANDYDEFS.H match_player.tm_y; teams[6]","Native player Y position.","native-position","f32"],
  ["players.spain-player-07.y_displacement","spain-player-07 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[6]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.spain-player-07.z","spain-player-07 Z","ANDYDEFS.H match_player.tm_z; teams[6]","Native player Z position.","native-position","f32"],
  ["players.spain-player-07.z_displacement","spain-player-07 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[6]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.spain-player-08.action","spain-player-08 Action","ANDYDEFS.H match_player.tm_act; teams[7]","Native player action.",null,"i16"],
  ["players.spain-player-08.animation","spain-player-08 Animation","ANDYDEFS.H match_player.tm_anim; teams[7]","Native animation identifier.",null,"u16"],
  ["players.spain-player-08.animation_frame","spain-player-08 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[7]","Native animation frame.",null,"f32"],
  ["players.spain-player-08.ball_state","spain-player-08 Ball state","ANDYDEFS.H match_player.ball_state; teams[7]","Native player-ball state.",null,"i16"],
  ["players.spain-player-08.control","spain-player-08 Control","ANDYDEFS.H match_player.control; teams[7]","Native player control state.",null,"u8"],
  ["players.spain-player-08.face_direction","spain-player-08 Face direction","ANDYDEFS.H match_player.face_dir; teams[7]","Native facing direction.",null,"i16"],
  ["players.spain-player-08.native_player","spain-player-08 Native player","ANDYDEFS.H match_player.tm_player; teams[7]","Native player identifier.",null,"i16"],
  ["players.spain-player-08.on","spain-player-08 On pitch","ANDYDEFS.H match_player.guy_on; teams[7]","Native active/on-pitch state.",null,"i16"],
  ["players.spain-player-08.possession","spain-player-08 Possession","ANDYDEFS.H match_player.tm_poss; teams[7]","Native player possession/action state.",null,"i16"],
  ["players.spain-player-08.stable_id","spain-player-08 Stable id","fixture spain starter 8","Prepared stable starter identity.",null,"string"],
  ["players.spain-player-08.x","spain-player-08 X","ANDYDEFS.H match_player.tm_x; teams[7]","Native player X position.","native-position","f32"],
  ["players.spain-player-08.x_displacement","spain-player-08 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[7]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.spain-player-08.y","spain-player-08 Y","ANDYDEFS.H match_player.tm_y; teams[7]","Native player Y position.","native-position","f32"],
  ["players.spain-player-08.y_displacement","spain-player-08 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[7]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.spain-player-08.z","spain-player-08 Z","ANDYDEFS.H match_player.tm_z; teams[7]","Native player Z position.","native-position","f32"],
  ["players.spain-player-08.z_displacement","spain-player-08 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[7]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.spain-player-09.action","spain-player-09 Action","ANDYDEFS.H match_player.tm_act; teams[8]","Native player action.",null,"i16"],
  ["players.spain-player-09.animation","spain-player-09 Animation","ANDYDEFS.H match_player.tm_anim; teams[8]","Native animation identifier.",null,"u16"],
  ["players.spain-player-09.animation_frame","spain-player-09 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[8]","Native animation frame.",null,"f32"],
  ["players.spain-player-09.ball_state","spain-player-09 Ball state","ANDYDEFS.H match_player.ball_state; teams[8]","Native player-ball state.",null,"i16"],
  ["players.spain-player-09.control","spain-player-09 Control","ANDYDEFS.H match_player.control; teams[8]","Native player control state.",null,"u8"],
  ["players.spain-player-09.face_direction","spain-player-09 Face direction","ANDYDEFS.H match_player.face_dir; teams[8]","Native facing direction.",null,"i16"],
  ["players.spain-player-09.native_player","spain-player-09 Native player","ANDYDEFS.H match_player.tm_player; teams[8]","Native player identifier.",null,"i16"],
  ["players.spain-player-09.on","spain-player-09 On pitch","ANDYDEFS.H match_player.guy_on; teams[8]","Native active/on-pitch state.",null,"i16"],
  ["players.spain-player-09.possession","spain-player-09 Possession","ANDYDEFS.H match_player.tm_poss; teams[8]","Native player possession/action state.",null,"i16"],
  ["players.spain-player-09.stable_id","spain-player-09 Stable id","fixture spain starter 9","Prepared stable starter identity.",null,"string"],
  ["players.spain-player-09.x","spain-player-09 X","ANDYDEFS.H match_player.tm_x; teams[8]","Native player X position.","native-position","f32"],
  ["players.spain-player-09.x_displacement","spain-player-09 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[8]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.spain-player-09.y","spain-player-09 Y","ANDYDEFS.H match_player.tm_y; teams[8]","Native player Y position.","native-position","f32"],
  ["players.spain-player-09.y_displacement","spain-player-09 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[8]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.spain-player-09.z","spain-player-09 Z","ANDYDEFS.H match_player.tm_z; teams[8]","Native player Z position.","native-position","f32"],
  ["players.spain-player-09.z_displacement","spain-player-09 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[8]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.spain-player-10.action","spain-player-10 Action","ANDYDEFS.H match_player.tm_act; teams[9]","Native player action.",null,"i16"],
  ["players.spain-player-10.animation","spain-player-10 Animation","ANDYDEFS.H match_player.tm_anim; teams[9]","Native animation identifier.",null,"u16"],
  ["players.spain-player-10.animation_frame","spain-player-10 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[9]","Native animation frame.",null,"f32"],
  ["players.spain-player-10.ball_state","spain-player-10 Ball state","ANDYDEFS.H match_player.ball_state; teams[9]","Native player-ball state.",null,"i16"],
  ["players.spain-player-10.control","spain-player-10 Control","ANDYDEFS.H match_player.control; teams[9]","Native player control state.",null,"u8"],
  ["players.spain-player-10.face_direction","spain-player-10 Face direction","ANDYDEFS.H match_player.face_dir; teams[9]","Native facing direction.",null,"i16"],
  ["players.spain-player-10.native_player","spain-player-10 Native player","ANDYDEFS.H match_player.tm_player; teams[9]","Native player identifier.",null,"i16"],
  ["players.spain-player-10.on","spain-player-10 On pitch","ANDYDEFS.H match_player.guy_on; teams[9]","Native active/on-pitch state.",null,"i16"],
  ["players.spain-player-10.possession","spain-player-10 Possession","ANDYDEFS.H match_player.tm_poss; teams[9]","Native player possession/action state.",null,"i16"],
  ["players.spain-player-10.stable_id","spain-player-10 Stable id","fixture spain starter 10","Prepared stable starter identity.",null,"string"],
  ["players.spain-player-10.x","spain-player-10 X","ANDYDEFS.H match_player.tm_x; teams[9]","Native player X position.","native-position","f32"],
  ["players.spain-player-10.x_displacement","spain-player-10 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[9]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.spain-player-10.y","spain-player-10 Y","ANDYDEFS.H match_player.tm_y; teams[9]","Native player Y position.","native-position","f32"],
  ["players.spain-player-10.y_displacement","spain-player-10 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[9]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.spain-player-10.z","spain-player-10 Z","ANDYDEFS.H match_player.tm_z; teams[9]","Native player Z position.","native-position","f32"],
  ["players.spain-player-10.z_displacement","spain-player-10 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[9]","Native player Z displacement.","native-position-per-tick","f32"],
  ["players.spain-player-11.action","spain-player-11 Action","ANDYDEFS.H match_player.tm_act; teams[10]","Native player action.",null,"i16"],
  ["players.spain-player-11.animation","spain-player-11 Animation","ANDYDEFS.H match_player.tm_anim; teams[10]","Native animation identifier.",null,"u16"],
  ["players.spain-player-11.animation_frame","spain-player-11 Animation frame","ANDYDEFS.H match_player.tm_frm; teams[10]","Native animation frame.",null,"f32"],
  ["players.spain-player-11.ball_state","spain-player-11 Ball state","ANDYDEFS.H match_player.ball_state; teams[10]","Native player-ball state.",null,"i16"],
  ["players.spain-player-11.control","spain-player-11 Control","ANDYDEFS.H match_player.control; teams[10]","Native player control state.",null,"u8"],
  ["players.spain-player-11.face_direction","spain-player-11 Face direction","ANDYDEFS.H match_player.face_dir; teams[10]","Native facing direction.",null,"i16"],
  ["players.spain-player-11.native_player","spain-player-11 Native player","ANDYDEFS.H match_player.tm_player; teams[10]","Native player identifier.",null,"i16"],
  ["players.spain-player-11.on","spain-player-11 On pitch","ANDYDEFS.H match_player.guy_on; teams[10]","Native active/on-pitch state.",null,"i16"],
  ["players.spain-player-11.possession","spain-player-11 Possession","ANDYDEFS.H match_player.tm_poss; teams[10]","Native player possession/action state.",null,"i16"],
  ["players.spain-player-11.stable_id","spain-player-11 Stable id","fixture spain starter 11","Prepared stable starter identity.",null,"string"],
  ["players.spain-player-11.x","spain-player-11 X","ANDYDEFS.H match_player.tm_x; teams[10]","Native player X position.","native-position","f32"],
  ["players.spain-player-11.x_displacement","spain-player-11 X displacement","ANDYDEFS.H match_player.tm_xdis; teams[10]","Native player X displacement.","native-position-per-tick","f32"],
  ["players.spain-player-11.y","spain-player-11 Y","ANDYDEFS.H match_player.tm_y; teams[10]","Native player Y position.","native-position","f32"],
  ["players.spain-player-11.y_displacement","spain-player-11 Y displacement","ANDYDEFS.H match_player.tm_ydis; teams[10]","Native player Y displacement.","native-position-per-tick","f32"],
  ["players.spain-player-11.z","spain-player-11 Z","ANDYDEFS.H match_player.tm_z; teams[10]","Native player Z position.","native-position","f32"],
  ["players.spain-player-11.z_displacement","spain-player-11 Z displacement","ANDYDEFS.H match_player.tm_zdis; teams[10]","Native player Z displacement.","native-position-per-tick","f32"],
  ["rng.rand_seed","Random seed state","EXTERNS.H rand_seed; MATHS.CPP","Native mutable RNG state.",null,"i16"],
  ["rng.seed","Seed","EXTERNS.H seed; MATHS.CPP","Native secondary RNG seed.",null,"i16"],
  ["rules.dead_ball_count","Dead-ball count","EXTERNS.H dead_ball_cnt; RULES.CPP","Native dead-ball countdown.","ticks","i32"],
  ["rules.direct_free_kick","Direct free kick","EXTERNS.H direct_fk; RULES.CPP","Native direct-free-kick flag.",null,"u8"],
  ["rules.game_action","Game action","EXTERNS.H game_action; RULES.CPP","Native current game action.",null,"i16"],
  ["rules.match_mode","Match mode","EXTERNS.H match_mode; RULES.CPP","Native restart and lifecycle mode.",null,"u8"],
  ["rules.offside_now","Offside now","EXTERNS.H offside_now; RULES.CPP","Native immediate offside flag.",null,"u8"],
  ["rules.offside_on","Offside enabled","EXTERNS.H offside_on; RULES.CPP","Native offside rule enablement.",null,"u8"],
  ["rules.penalty_game","Penalty game","FOOTBALL.CPP penalty_game; RULES.CPP","Native shootout state.",null,"u8"],
  ["rules.set_piece","Set piece","EXTERNS.H set_piece_on; RULES.CPP","Native set-piece state.",null,"u8"],
  ["score.goal_scorer","Goal scorer","EXTERNS.H goal_scorer; RULES.CPP","Native latest goal-scorer index.",null,"i32"],
  ["score.just_scored","Just scored","EXTERNS.H just_scored; RULES.CPP","Native post-goal countdown/state.",null,"i32"],
  ["score.team_a","Team A goals","EXTERNS.H team_a_goals; RULES.CPP","Native team-A score.","goals","i32"],
  ["score.team_b","Team B goals","EXTERNS.H team_b_goals; RULES.CPP","Native team-B score.","goals","i32"],
];

export const CSSOCCER_NATIVE_FIELD_PHASES = deepFreeze([
  { id: "post_tick", order: 0 },
]);

export const CSSOCCER_NATIVE_FIELDS = deepFreeze(FIELD_ROWS.map(([
  id,
  label,
  sourceOwner,
  meaning,
  unit,
  valueType,
]) => ({
  id,
  label,
  sourceOwner,
  meaning,
  unit,
  valueType,
})));

export const CSSOCCER_NATIVE_FIELD_CONTRACT = deepFreeze({
  schema: CSSOCCER_NATIVE_FIELD_CONTRACT_SCHEMA,
  fixtureId: CSSOCCER_NATIVE_FIELD_FIXTURE_ID,
  contractSha256: CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
  coordinateOrder: ["tick", "phase", "field"],
  phaseCount: 1,
  fieldCount: CSSOCCER_NATIVE_FIELD_COUNT,
  playerFieldCount: PLAYER_FIELD_COUNT,
  domainCounts: EXPECTED_DOMAIN_COUNTS,
  playerIds: EXPECTED_PLAYER_IDS,
  phases: CSSOCCER_NATIVE_FIELD_PHASES,
  fields: CSSOCCER_NATIVE_FIELDS,
});

assertCanonicalContract(CSSOCCER_NATIVE_FIELD_CONTRACT);

function assertCanonicalContract(contract) {
  if (
    contract.schema !== CSSOCCER_NATIVE_FIELD_CONTRACT_SCHEMA
    || contract.fixtureId !== CSSOCCER_NATIVE_FIELD_FIXTURE_ID
    || contract.contractSha256 !== CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256
    || contract.phaseCount !== 1
    || contract.fieldCount !== CSSOCCER_NATIVE_FIELD_COUNT
    || contract.playerFieldCount !== PLAYER_FIELD_COUNT
    || contract.phases.length !== 1
    || contract.phases[0].id !== "post_tick"
    || contract.phases[0].order !== 0
  ) {
    throw new Error("Canonical native field contract metadata is inconsistent.");
  }

  const domainCounts = new Map();
  const playerFieldCounts = new Map();
  const playerSuffixes = new Map();
  const seen = new Set();
  let previousId = "";

  for (const [index, field] of contract.fields.entries()) {
    const keys = Object.keys(field);
    if (
      keys.length !== FIELD_KEYS.length
      || keys.some((key, keyIndex) => key !== FIELD_KEYS[keyIndex])
    ) {
      throw new Error("Canonical native field " + index + " has unsupported metadata.");
    }
    if (
      typeof field.id !== "string"
      || field.id.length === 0
      || typeof field.label !== "string"
      || field.label.length === 0
      || typeof field.sourceOwner !== "string"
      || field.sourceOwner.length === 0
      || typeof field.meaning !== "string"
      || field.meaning.length === 0
      || (field.unit !== null && (typeof field.unit !== "string" || field.unit.length === 0))
      || !SUPPORTED_VALUE_TYPES.has(field.valueType)
    ) {
      throw new Error("Canonical native field " + index + " is invalid.");
    }
    if (seen.has(field.id) || (previousId && field.id <= previousId)) {
      throw new Error("Canonical native fields must be unique and lexically ordered.");
    }
    seen.add(field.id);
    previousId = field.id;

    const parts = field.id.split(".");
    const domain = parts[0];
    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);

    if (domain === "players") {
      if (parts.length !== 3) {
        throw new Error("Canonical player field ids must contain player and field names.");
      }
      const playerId = parts[1];
      const suffix = parts[2];
      playerFieldCounts.set(playerId, (playerFieldCounts.get(playerId) ?? 0) + 1);
      if (!playerSuffixes.has(playerId)) playerSuffixes.set(playerId, new Set());
      playerSuffixes.get(playerId).add(suffix);
      if (suffix === "stable_id" && field.valueType !== "string") {
        throw new Error("Canonical stable player ids must remain typed strings.");
      }
    }
  }

  if (contract.fields.length !== CSSOCCER_NATIVE_FIELD_COUNT) {
    throw new Error("Canonical native field count changed.");
  }
  if (
    JSON.stringify(Object.fromEntries(domainCounts))
    !== JSON.stringify(EXPECTED_DOMAIN_COUNTS)
  ) {
    throw new Error("Canonical native field domain counts changed.");
  }
  if (
    JSON.stringify([...playerFieldCounts.keys()])
    !== JSON.stringify(EXPECTED_PLAYER_IDS)
  ) {
    throw new Error("Canonical stable player ids changed.");
  }
  for (const playerId of EXPECTED_PLAYER_IDS) {
    if (
      playerFieldCounts.get(playerId) !== PLAYER_FIELD_COUNT
      || playerSuffixes.get(playerId)?.size !== PLAYER_FIELD_COUNT
      || !playerSuffixes.get(playerId)?.has("stable_id")
    ) {
      throw new Error("Canonical player field contract changed for " + playerId + ".");
    }
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
