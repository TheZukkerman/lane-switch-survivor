import 'package:flutter_test/flutter_test.dart';

import 'package:lane_switch_survivor/main.dart';

void main() {
  testWidgets('game boots with core slice copy', (WidgetTester tester) async {
    await tester.pumpWidget(const LaneSwitchApp());

    expect(find.text('Single authored level. Three lanes, readable telegraphs, fast retry.'), findsOneWidget);
    expect(find.text('Time left'), findsOneWidget);
    expect(find.text('Restart'), findsOneWidget);
  });
}
