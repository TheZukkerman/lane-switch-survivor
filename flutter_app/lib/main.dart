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

enum RunState { briefing, countdown, playing, won, failed }

enum HazardKind { block, heavy, wide }

class SpawnEvent {
  const SpawnEvent({
    required this.hitTime,
    required this.lanes,
    required this.kind,
    this.note = '',
  });

  final double hitTime;
  final List<int> lanes;
  final HazardKind kind;
  final String note;
}

class TimelineHazard {
  const TimelineHazard({
    required this.id,
    required this.lane,
    required this.kind,
    required this.hitTime,
  });

  final int id;
  final int lane;
  final HazardKind kind;
  final double hitTime;
}

class GamePage extends StatefulWidget {
  const GamePage({super.key});

  @override
  State<GamePage> createState() => _GamePageState();
}

class _GamePageState extends State<GamePage>
    with SingleTickerProviderStateMixin {
  static const int laneCount = 3;
  static const double levelDuration = 26;
  static const double spawnLeadTime = 1.3;
  static const double lingerAfterHit = 0.2;
  static const double grazeWindow = 0.2;
  static const double countdownDuration = 1.0;

  static const List<SpawnEvent> _events = [
    SpawnEvent(
      hitTime: 6.2,
      lanes: [1],
      kind: HazardKind.block,
      note: 'Warm-up read',
    ),
    SpawnEvent(
      hitTime: 8.0,
      lanes: [0],
      kind: HazardKind.block,
      note: 'Single switch',
    ),
    SpawnEvent(
      hitTime: 9.8,
      lanes: [2],
      kind: HazardKind.block,
      note: 'Return read',
    ),
    SpawnEvent(
      hitTime: 11.7,
      lanes: [1],
      kind: HazardKind.heavy,
      note: 'Hold center',
    ),
    SpawnEvent(
      hitTime: 13.6,
      lanes: [0, 1],
      kind: HazardKind.wide,
      note: 'Safe lane right',
    ),
    SpawnEvent(
      hitTime: 15.3,
      lanes: [2],
      kind: HazardKind.block,
      note: 'Reset to center',
    ),
    SpawnEvent(
      hitTime: 17.1,
      lanes: [1],
      kind: HazardKind.block,
      note: 'Clean weave',
    ),
    SpawnEvent(
      hitTime: 18.8,
      lanes: [1, 2],
      kind: HazardKind.wide,
      note: 'Safe lane left',
    ),
    SpawnEvent(
      hitTime: 20.5,
      lanes: [0],
      kind: HazardKind.heavy,
      note: 'Late dodge',
    ),
    SpawnEvent(
      hitTime: 22.0,
      lanes: [2],
      kind: HazardKind.block,
      note: 'Final check',
    ),
    SpawnEvent(
      hitTime: 23.6,
      lanes: [0, 2],
      kind: HazardKind.wide,
      note: 'Center finish',
    ),
  ];

  late final Ticker _ticker;
  late final List<TimelineHazard> _timelineHazards;

  Duration? _lastTick;
  RunState _runState = RunState.briefing;
  int _playerLane = 1;
  double _runTime = 0;
  double _countdownLeft = countdownDuration;
  int _cleanDodges = 0;
  int _closeCalls = 0;
  String _statusText = 'Read the briefing, then hit start.';
  double? _touchStartX;
  final Set<int> _resolvedHazards = <int>{};
  final Set<int> _collidedHazards = <int>{};

  @override
  void initState() {
    super.initState();
    _timelineHazards = _buildHazards(_events);
    _ticker = createTicker(_tick)..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  List<TimelineHazard> _buildHazards(List<SpawnEvent> events) {
    final hazards = <TimelineHazard>[];
    var nextId = 0;
    for (final event in events) {
      for (final lane in event.lanes) {
        hazards.add(
          TimelineHazard(
            id: nextId++,
            lane: lane,
            kind: event.kind,
            hitTime: event.hitTime,
          ),
        );
      }
    }
    return hazards;
  }

  void _tick(Duration elapsed) {
    final lastTick = _lastTick;
    _lastTick = elapsed;
    if (lastTick == null || !mounted) {
      if (mounted) setState(() {});
      return;
    }

    final delta =
        ((elapsed - lastTick).inMicroseconds / Duration.microsecondsPerSecond)
            .clamp(0.0, 0.033);

    setState(() {
      switch (_runState) {
        case RunState.briefing:
        case RunState.failed:
        case RunState.won:
          return;
        case RunState.countdown:
          _countdownLeft = math.max(0, _countdownLeft - delta);
          if (_countdownLeft <= 0) {
            _runState = RunState.playing;
            _statusText = 'Go. Read the telegraph, keep the safe lane.';
          }
          return;
        case RunState.playing:
          _runTime += delta;
          _resolveHazards();
          _evaluateWin();
          return;
      }
    });
  }

  List<TimelineHazard> _visibleHazards() {
    return _timelineHazards
        .where((hazard) {
          final visibleFrom = hazard.hitTime - spawnLeadTime;
          final visibleUntil = hazard.hitTime + lingerAfterHit;
          return _runTime >= visibleFrom && _runTime <= visibleUntil;
        })
        .toList(growable: false);
  }

  void _resolveHazards() {
    for (final hazard in _timelineHazards) {
      if (_resolvedHazards.contains(hazard.id)) {
        continue;
      }

      final distanceToHit = (_runTime - hazard.hitTime).abs();
      if (distanceToHit <= grazeWindow && _playerLane == hazard.lane) {
        _resolvedHazards.add(hazard.id);
        _collidedHazards.add(hazard.id);
        _runState = RunState.failed;
        _statusText = 'You clipped lane ${hazard.lane + 1}. Retry is clean.';
        return;
      }

      if (_runTime > hazard.hitTime + grazeWindow) {
        _resolvedHazards.add(hazard.id);
        if (_playerLane != hazard.lane) {
          _cleanDodges += 1;
          final margin = _runTime - hazard.hitTime;
          if (margin < 0.12) {
            _closeCalls += 1;
          }
        }
      }
    }
  }

  void _evaluateWin() {
    if (_runState != RunState.playing) return;
    if (_runTime >= levelDuration &&
        _resolvedHazards.length == _timelineHazards.length &&
        _collidedHazards.isEmpty) {
      _runState = RunState.won;
      _statusText = 'Level clear. ${_stars()} star run.';
    }
  }

  void _beginCountdown() {
    _resetRun(showBriefing: false);
    setState(() {
      _runState = RunState.countdown;
      _countdownLeft = countdownDuration;
      _statusText = 'Ready...';
    });
  }

  void _move(int delta) {
    if (_runState != RunState.playing) return;
    final nextLane = (_playerLane + delta).clamp(0, laneCount - 1);
    if (nextLane == _playerLane) return;
    setState(() {
      _playerLane = nextLane;
      _statusText = 'Lane ${_playerLane + 1}. Stay calm and read ahead.';
    });
  }

  void _handleTap(TapDownDetails details, BoxConstraints constraints) {
    final tapX = details.localPosition.dx;
    final width = constraints.maxWidth;
    _move(tapX < width / 2 ? -1 : 1);
  }

  void _resetRun({bool showBriefing = true}) {
    _playerLane = 1;
    _runTime = 0;
    _countdownLeft = countdownDuration;
    _cleanDodges = 0;
    _closeCalls = 0;
    _touchStartX = null;
    _resolvedHazards.clear();
    _collidedHazards.clear();
    _lastTick = null;
    if (showBriefing) {
      _runState = RunState.briefing;
      _statusText = 'Read the briefing, then hit start.';
    }
  }

  void _showBriefing() {
    setState(() {
      _resetRun(showBriefing: true);
    });
  }

  int _stars() {
    if (_runState != RunState.won) return 0;
    if (_closeCalls == 0) return 3;
    if (_closeCalls <= 2) return 2;
    return 1;
  }

  String _stateLabel() {
    switch (_runState) {
      case RunState.briefing:
        return 'BRIEF';
      case RunState.countdown:
        return 'READY';
      case RunState.playing:
        return 'LIVE';
      case RunState.won:
        return 'CLEAR';
      case RunState.failed:
        return 'FAIL';
    }
  }

  String _countdownText() {
    if (_countdownLeft <= 0.18) return 'GO';
    return 'START';
  }

  @override
  Widget build(BuildContext context) {
    final visibleHazards = _visibleHazards();
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
                  _StatChip(
                    label: 'Time left',
                    value: '${remaining.toStringAsFixed(1)}s',
                  ),
                  const SizedBox(width: 8),
                  _StatChip(
                    label: 'Clean',
                    value: '$_cleanDodges/${_timelineHazards.length}',
                  ),
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
                'Short first level. Safe tutorial start, readable lanes, clean retries.',
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: Colors.white70),
              ),
              const SizedBox(height: 14),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    return GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTapDown: (details) => _handleTap(details, constraints),
                      onHorizontalDragStart: (details) =>
                          _touchStartX = details.localPosition.dx,
                      onHorizontalDragUpdate: (details) {
                        final start = _touchStartX;
                        if (start == null || _runState != RunState.playing) {
                          return;
                        }
                        final dx = details.localPosition.dx - start;
                        if (dx.abs() >= 28) {
                          _move(dx > 0 ? 1 : -1);
                          _touchStartX = details.localPosition.dx;
                        }
                      },
                      onHorizontalDragEnd: (_) => _touchStartX = null,
                      onHorizontalDragCancel: () => _touchStartX = null,
                      child: Stack(
                        children: [
                          CustomPaint(
                            painter: GamePainter(
                              playerLane: _playerLane,
                              runState: _runState,
                              hazards: visibleHazards,
                              runTime: _runTime,
                              spawnLeadTime: spawnLeadTime,
                              countdownText: _countdownText(),
                            ),
                            child: const SizedBox.expand(),
                          ),
                          if (_runState == RunState.briefing)
                            _BriefingCard(
                              onStart: _beginCountdown,
                              objective: 'Survive one short lane run.',
                              reward: 'Unlock the next mobile test build.',
                              controls:
                                  'Tap left/right or swipe to switch one lane instantly.',
                            ),
                        ],
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
                          : 'Hazards stay locked to the scroll path and clear off-screen right after they pass.',
                      style: Theme.of(
                        context,
                      ).textTheme.bodyMedium?.copyWith(color: Colors.white70),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.tonal(
                            onPressed: _runState == RunState.playing
                                ? () => _move(-1)
                                : null,
                            child: const Text('Left'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton(
                            onPressed: _showBriefing,
                            child: Text(
                              _runState == RunState.won
                                  ? 'Play again'
                                  : _runState == RunState.failed
                                  ? 'Retry'
                                  : 'Reset',
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton.tonal(
                            onPressed: _runState == RunState.playing
                                ? () => _move(1)
                                : null,
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

class _BriefingCard extends StatelessWidget {
  const _BriefingCard({
    required this.onStart,
    required this.objective,
    required this.reward,
    required this.controls,
  });

  final VoidCallback onStart;
  final String objective;
  final String reward;
  final String controls;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(24),
        ),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Container(
              margin: const EdgeInsets.all(20),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF10182A),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white24),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Level 1 briefing',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 12),
                    _BriefingRow(label: 'Goal', value: objective),
                    const SizedBox(height: 8),
                    _BriefingRow(label: 'Reward', value: reward),
                    const SizedBox(height: 8),
                    _BriefingRow(label: 'Controls', value: controls),
                    const SizedBox(height: 8),
                    const _BriefingRow(
                      label: 'Start signal',
                      value: 'Press START, get a clear READY beat, then GO.',
                    ),
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: onStart,
                        child: const Text('START RUN'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _BriefingRow extends StatelessWidget {
  const _BriefingRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return RichText(
      text: TextSpan(
        style: Theme.of(
          context,
        ).textTheme.bodyLarge?.copyWith(color: Colors.white),
        children: [
          TextSpan(
            text: '$label: ',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          TextSpan(text: value),
        ],
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
            Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.labelMedium?.copyWith(color: Colors.white60),
            ),
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
    required this.countdownText,
  });

  final int playerLane;
  final RunState runState;
  final List<TimelineHazard> hazards;
  final double runTime;
  final double spawnLeadTime;
  final String countdownText;

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
      final laneRect = Rect.fromLTWH(
        lane * laneWidth,
        0,
        laneWidth,
        size.height,
      );
      final fill = Paint()
        ..color = lane.isEven
            ? Colors.white.withValues(alpha: 0.035)
            : Colors.white.withValues(alpha: 0.065);
      canvas.drawRect(laneRect, fill);
    }

    final laneDivider = Paint()
      ..color = Colors.white.withValues(alpha: 0.12)
      ..strokeWidth = 2;
    for (var lane = 1; lane < 3; lane++) {
      final x = lane * laneWidth;
      for (double y = 0; y < size.height; y += 26) {
        canvas.drawLine(
          Offset(x, y),
          Offset(x, math.min(y + 14, size.height)),
          laneDivider,
        );
      }
    }

    for (final hazard in hazards) {
      final laneLeft = hazard.lane * laneWidth;
      final travelProgress =
          ((runTime - (hazard.hitTime - spawnLeadTime)) / spawnLeadTime).clamp(
            0.0,
            1.0,
          );
      final top = lerpDouble(
        -_hazardHeight(hazard.kind) - 10,
        playerY - _hazardHeight(hazard.kind) / 2,
        Curves.easeIn.transform(travelProgress),
      )!;

      final telegraphRect = Rect.fromLTWH(
        laneLeft + laneWidth * 0.12,
        18,
        laneWidth * 0.76,
        18,
      );
      final telegraphPaint = Paint()
        ..color = _hazardColor(
          hazard.kind,
        ).withValues(alpha: 0.24 + (0.46 * (1 - travelProgress)));
      canvas.drawRRect(
        RRect.fromRectAndRadius(telegraphRect, const Radius.circular(10)),
        telegraphPaint,
      );

      final hazardRect = Rect.fromLTWH(
        laneLeft + laneWidth * 0.14,
        top,
        laneWidth * 0.72,
        _hazardHeight(hazard.kind),
      );
      final hazardPaint = Paint()..color = _hazardColor(hazard.kind);
      canvas.drawRRect(
        RRect.fromRectAndRadius(hazardRect, const Radius.circular(16)),
        hazardPaint,
      );

      final shinePaint = Paint()..color = Colors.white.withValues(alpha: 0.22);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(
            hazardRect.left + 8,
            hazardRect.top + 8,
            hazardRect.width - 16,
            10,
          ),
          const Radius.circular(6),
        ),
        shinePaint,
      );
    }

    final playerCenter = Offset(
      playerLane * laneWidth + laneWidth / 2,
      playerY,
    );
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

    switch (runState) {
      case RunState.briefing:
        _banner(canvas, size, 'Read the briefing');
        break;
      case RunState.countdown:
        _banner(canvas, size, countdownText);
        break;
      case RunState.failed:
        _banner(canvas, size, 'Fail • Retry');
        break;
      case RunState.won:
        _banner(canvas, size, 'Clear');
        break;
      case RunState.playing:
        break;
    }
  }

  double _hazardHeight(HazardKind kind) {
    switch (kind) {
      case HazardKind.block:
        return 54;
      case HazardKind.heavy:
        return 72;
      case HazardKind.wide:
        return 60;
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
    canvas.drawRRect(
      rect,
      Paint()..color = Colors.black.withValues(alpha: 0.55),
    );
    final textPainter = TextPainter(
      text: TextSpan(
        text: text,
        style: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
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
        oldDelegate.countdownText != countdownText ||
        oldDelegate.hazards.length != hazards.length;
  }
}

double? lerpDouble(num? a, num? b, double t) {
  if (a == null || b == null) return null;
  return a + (b - a) * t;
}
