import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

void main() {
  runApp(const LaneSwitchApp());
}

class LaneSwitchApp extends StatelessWidget {
  const LaneSwitchApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Lane Switch Survivor',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF090E1A),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF69F0FF),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const GamePage(),
    );
  }
}

enum RunState { ready, playing, won, failed }

enum HazardKind { block, heavy, wide }

class SpawnEvent {
  const SpawnEvent({
    required this.hitTime,
    required this.lanes,
    required this.kind,
  });

  final double hitTime;
  final List<int> lanes;
  final HazardKind kind;
}

class ActiveHazard {
  ActiveHazard({
    required this.lane,
    required this.kind,
    required this.spawnTime,
    required this.hitTime,
  });

  final int lane;
  final HazardKind kind;
  final double spawnTime;
  final double hitTime;
  bool countedClean = false;
}

class GamePage extends StatefulWidget {
  const GamePage({super.key});

  @override
  State<GamePage> createState() => _GamePageState();
}

class _GamePageState extends State<GamePage>
    with SingleTickerProviderStateMixin {
  static const int laneCount = 3;
  static const double levelDuration = 42;
  static const double spawnLeadTime = 1.45;
  static const double grazeWindow = 0.22;

  late final Ticker _ticker;
  Duration? _lastTick;

  final List<SpawnEvent> _events = const [
    SpawnEvent(hitTime: 2.4, lanes: [1], kind: HazardKind.block),
    SpawnEvent(hitTime: 4.2, lanes: [0], kind: HazardKind.block),
    SpawnEvent(hitTime: 5.9, lanes: [2], kind: HazardKind.heavy),
    SpawnEvent(hitTime: 7.6, lanes: [1], kind: HazardKind.block),
    SpawnEvent(hitTime: 9.1, lanes: [0, 1], kind: HazardKind.wide),
    SpawnEvent(hitTime: 10.8, lanes: [2], kind: HazardKind.block),
    SpawnEvent(hitTime: 12.6, lanes: [1], kind: HazardKind.heavy),
    SpawnEvent(hitTime: 14.2, lanes: [1, 2], kind: HazardKind.wide),
    SpawnEvent(hitTime: 16.0, lanes: [0], kind: HazardKind.block),
    SpawnEvent(hitTime: 17.8, lanes: [2], kind: HazardKind.block),
    SpawnEvent(hitTime: 19.1, lanes: [0, 2], kind: HazardKind.wide),
    SpawnEvent(hitTime: 20.8, lanes: [1], kind: HazardKind.heavy),
    SpawnEvent(hitTime: 22.3, lanes: [0], kind: HazardKind.block),
    SpawnEvent(hitTime: 24.0, lanes: [2], kind: HazardKind.heavy),
    SpawnEvent(hitTime: 25.7, lanes: [1], kind: HazardKind.block),
    SpawnEvent(hitTime: 27.5, lanes: [0, 1], kind: HazardKind.wide),
    SpawnEvent(hitTime: 29.2, lanes: [2], kind: HazardKind.block),
    SpawnEvent(hitTime: 31.0, lanes: [0], kind: HazardKind.heavy),
    SpawnEvent(hitTime: 32.7, lanes: [1, 2], kind: HazardKind.wide),
    SpawnEvent(hitTime: 34.5, lanes: [0], kind: HazardKind.block),
    SpawnEvent(hitTime: 36.0, lanes: [2], kind: HazardKind.block),
    SpawnEvent(hitTime: 37.6, lanes: [1], kind: HazardKind.heavy),
    SpawnEvent(hitTime: 39.2, lanes: [0, 2], kind: HazardKind.wide),
    SpawnEvent(hitTime: 40.7, lanes: [1], kind: HazardKind.block),
  ];

  RunState _runState = RunState.ready;
  final List<ActiveHazard> _hazards = [];
  int _playerLane = 1;
  int _nextSpawnIndex = 0;
  double _runTime = 0;
  int _cleanDodges = 0;
  int _closeCalls = 0;
  String _statusText = 'Tap left or right side to launch and switch lanes.';
  double? _touchStartX;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_tick);
    _ticker.start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  void _tick(Duration elapsed) {
    final lastTick = _lastTick;
    _lastTick = elapsed;
    if (lastTick == null || !mounted || _runState != RunState.playing) {
      if (mounted) setState(() {});
      return;
    }

    final delta = (elapsed - lastTick).inMicroseconds / Duration.microsecondsPerSecond;
    final clampedDelta = delta.clamp(0.0, 0.033);

    setState(() {
      _runTime += clampedDelta;
      _spawnHazards();
      _updateHazards();
      _evaluateWin();
    });
  }

  void _spawnHazards() {
    while (_nextSpawnIndex < _events.length) {
      final event = _events[_nextSpawnIndex];
      if (_runTime < event.hitTime - spawnLeadTime) break;

      for (final lane in event.lanes) {
        _hazards.add(
          ActiveHazard(
            lane: lane,
            kind: event.kind,
            spawnTime: event.hitTime - spawnLeadTime,
            hitTime: event.hitTime,
          ),
        );
      }
      _nextSpawnIndex += 1;
    }
  }

  void _updateHazards() {
    for (final hazard in _hazards) {
      final nearHit = (_runTime - hazard.hitTime).abs() <= grazeWindow;
      if (nearHit && _playerLane == hazard.lane) {
        _runState = RunState.failed;
        _statusText = 'Hit on lane ${hazard.lane + 1}. Retry instantly.';
        return;
      }

      if (!hazard.countedClean && _runTime > hazard.hitTime + grazeWindow) {
        hazard.countedClean = true;
        if (_playerLane != hazard.lane) {
          _cleanDodges += 1;
          if ((_runTime - hazard.hitTime) < 0.16) {
            _closeCalls += 1;
          }
        }
      }
    }

    _hazards.removeWhere((hazard) => _runTime > hazard.hitTime + 0.9);
  }

  void _evaluateWin() {
    if (_runState != RunState.playing) return;
    if (_runTime >= levelDuration && _nextSpawnIndex >= _events.length && _hazards.isEmpty) {
      _runState = RunState.won;
      _statusText = 'Level clear. ${_stars()} star run.';
    }
  }

  void _startRunIfNeeded() {
    if (_runState == RunState.ready) {
      _runState = RunState.playing;
      _statusText = 'Read early. Commit before the block reaches you.';
    }
  }

  void _move(int delta) {
    if (_runState == RunState.failed || _runState == RunState.won) return;
    _startRunIfNeeded();
    if (_runState != RunState.playing) return;
    _playerLane = (_playerLane + delta).clamp(0, laneCount - 1);
  }

  void _handleTap(TapDownDetails details, BoxConstraints constraints) {
    final tapX = details.localPosition.dx;
    final width = constraints.maxWidth;
    _move(tapX < width / 2 ? -1 : 1);
  }

  void _restart() {
    setState(() {
      _runState = RunState.ready;
      _playerLane = 1;
      _nextSpawnIndex = 0;
      _runTime = 0;
      _cleanDodges = 0;
      _closeCalls = 0;
      _hazards.clear();
      _touchStartX = null;
      _statusText = 'Tap left or right side to launch and switch lanes.';
      _lastTick = null;
    });
  }

  int _stars() {
    if (_runState != RunState.won) return 0;
    if (_closeCalls == 0) return 3;
    if (_closeCalls <= 3) return 2;
    return 1;
  }

  String _stateLabel() {
    switch (_runState) {
      case RunState.ready:
        return 'READY';
      case RunState.playing:
        return 'LIVE';
      case RunState.won:
        return 'CLEAR';
      case RunState.failed:
        return 'FAIL';
    }
  }

  @override
  Widget build(BuildContext context) {
    final remaining = math.max(0, levelDuration - _runTime);
    final progress = (_runTime / levelDuration).clamp(0.0, 1.0);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Row(
                children: [
                  _StatChip(label: 'State', value: _stateLabel()),
                  const SizedBox(width: 8),
                  _StatChip(label: 'Time left', value: '${remaining.toStringAsFixed(1)}s'),
                  const SizedBox(width: 8),
                  _StatChip(label: 'Clean', value: '$_cleanDodges/${_events.length}'),
                ],
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 10,
                  backgroundColor: Colors.white12,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Single authored level. Three lanes, readable telegraphs, fast retry.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white70),
              ),
              const SizedBox(height: 14),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    return GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTapDown: (details) => _handleTap(details, constraints),
                      onHorizontalDragStart: (details) => _touchStartX = details.localPosition.dx,
                      onHorizontalDragUpdate: (details) {
                        final start = _touchStartX;
                        if (start == null) return;
                        final dx = details.localPosition.dx - start;
                        if (dx.abs() > 24) {
                          _move(dx > 0 ? 1 : -1);
                          _touchStartX = details.localPosition.dx;
                        }
                      },
                      onHorizontalDragEnd: (_) => _touchStartX = null,
                      child: CustomPaint(
                        painter: GamePainter(
                          playerLane: _playerLane,
                          runState: _runState,
                          hazards: List<ActiveHazard>.from(_hazards),
                          runTime: _runTime,
                          spawnLeadTime: spawnLeadTime,
                        ),
                        child: const SizedBox.expand(),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFF111A2C),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.white12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _statusText,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _runState == RunState.won
                          ? 'Mastery: ${_stars()} stars, $_closeCalls close calls.'
                          : 'Hazards: light block, heavy block, and double-lane wall. Restart is instant.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white70),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.tonal(
                            onPressed: () => _move(-1),
                            child: const Text('Left'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton(
                            onPressed: _restart,
                            child: Text(
                              _runState == RunState.ready ? 'Restart' : 'Retry now',
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton.tonal(
                            onPressed: () => _move(1),
                            child: const Text('Right'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF111A2C),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: Colors.white60)),
            const SizedBox(height: 4),
            Text(value, style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
      ),
    );
  }
}

class GamePainter extends CustomPainter {
  GamePainter({
    required this.playerLane,
    required this.runState,
    required this.hazards,
    required this.runTime,
    required this.spawnLeadTime,
  });

  final int playerLane;
  final RunState runState;
  final List<ActiveHazard> hazards;
  final double runTime;
  final double spawnLeadTime;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final background = Paint()
      ..shader = const LinearGradient(
        colors: [Color(0xFF10192E), Color(0xFF060A12)],
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
      ).createShader(rect);
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(24)),
      background,
    );

    final laneWidth = size.width / 3;
    final playerY = size.height * 0.82;

    for (var lane = 0; lane < 3; lane++) {
      final laneRect = Rect.fromLTWH(lane * laneWidth, 0, laneWidth, size.height);
      final fill = Paint()
        ..color = lane.isEven ? Colors.white.withValues(alpha: 0.035) : Colors.white.withValues(alpha: 0.065);
      canvas.drawRect(laneRect, fill);
    }

    final laneDivider = Paint()
      ..color = Colors.white.withValues(alpha: 0.12)
      ..strokeWidth = 2;
    for (var lane = 1; lane < 3; lane++) {
      final x = lane * laneWidth;
      for (double y = 0; y < size.height; y += 26) {
        canvas.drawLine(Offset(x, y), Offset(x, math.min(y + 14, size.height)), laneDivider);
      }
    }

    for (final hazard in hazards) {
      final laneLeft = hazard.lane * laneWidth;
      final progress = ((runTime - hazard.spawnTime) / spawnLeadTime).clamp(0.0, 1.0);
      final top = lerpDouble(-size.height * 0.14, playerY - _hazardHeight(hazard.kind) / 2, progress)!;
      final hazardRect = Rect.fromLTWH(
        laneLeft + laneWidth * 0.14,
        top,
        laneWidth * 0.72,
        _hazardHeight(hazard.kind),
      );

      final telegraphRect = Rect.fromLTWH(
        laneLeft + laneWidth * 0.12,
        18,
        laneWidth * 0.76,
        18,
      );
      final telegraphPaint = Paint()
        ..color = _hazardColor(hazard.kind).withValues(alpha: 0.28 + (0.45 * (1 - progress)));
      canvas.drawRRect(
        RRect.fromRectAndRadius(telegraphRect, const Radius.circular(10)),
        telegraphPaint,
      );

      final hazardPaint = Paint()..color = _hazardColor(hazard.kind);
      canvas.drawRRect(
        RRect.fromRectAndRadius(hazardRect, const Radius.circular(16)),
        hazardPaint,
      );

      final shinePaint = Paint()..color = Colors.white.withValues(alpha: 0.28);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(hazardRect.left + 8, hazardRect.top + 8, hazardRect.width - 16, 10),
          const Radius.circular(6),
        ),
        shinePaint,
      );
    }

    final playerCenter = Offset(playerLane * laneWidth + laneWidth / 2, playerY);
    canvas.drawCircle(
      playerCenter,
      24,
      Paint()..color = const Color(0xFF72F7FF),
    );
    canvas.drawCircle(
      playerCenter.translate(0, -8),
      8,
      Paint()..color = Colors.white,
    );

    if (runState == RunState.ready) {
      _banner(canvas, size, 'Tap a side to start');
    } else if (runState == RunState.failed) {
      _banner(canvas, size, 'Fail • Retry now');
    } else if (runState == RunState.won) {
      _banner(canvas, size, 'Clear');
    }
  }

  double _hazardHeight(HazardKind kind) {
    switch (kind) {
      case HazardKind.block:
        return 54;
      case HazardKind.heavy:
        return 74;
      case HazardKind.wide:
        return 62;
    }
  }

  Color _hazardColor(HazardKind kind) {
    switch (kind) {
      case HazardKind.block:
        return const Color(0xFFFF627D);
      case HazardKind.heavy:
        return const Color(0xFFFF9B54);
      case HazardKind.wide:
        return const Color(0xFFC86BFF);
    }
  }

  void _banner(Canvas canvas, Size size, String text) {
    final rect = RRect.fromRectAndRadius(
      Rect.fromLTWH(18, 18, size.width - 36, 48),
      const Radius.circular(16),
    );
    canvas.drawRRect(rect, Paint()..color = Colors.black.withValues(alpha: 0.55));
    final textPainter = TextPainter(
      text: TextSpan(
        text: text,
        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white),
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: size.width - 60);
    textPainter.paint(canvas, Offset((size.width - textPainter.width) / 2, 31));
  }

  @override
  bool shouldRepaint(covariant GamePainter oldDelegate) {
    return oldDelegate.playerLane != playerLane ||
        oldDelegate.runState != runState ||
        oldDelegate.runTime != runTime ||
        oldDelegate.hazards.length != hazards.length;
  }
}

double? lerpDouble(num? a, num? b, double t) {
  if (a == null || b == null) return null;
  return a + (b - a) * t;
}
