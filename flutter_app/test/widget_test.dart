import 'package:flutter_test/flutter_test.dart';

import 'package:lane_switch_survivor/main.dart';

void main() {
  testWidgets('game boots with briefing and reset flow', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const LaneSwitchApp());

    expect(
      find.text(
        'Short first level. Safe tutorial start, readable lanes, clean retries.',
      ),
      findsOneWidget,
    );
    expect(find.text('Time left'), findsOneWidget);
    expect(find.text('Level 1 briefing'), findsOneWidget);
    expect(find.text('START RUN'), findsOneWidget);
    expect(find.text('Reset'), findsOneWidget);
  });
}
