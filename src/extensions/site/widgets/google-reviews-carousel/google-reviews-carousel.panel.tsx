import type { FC } from 'react';
import { SectionHelper, SidePanel, Text, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';

// All customisation lives in the app's dashboard page, with a live preview. The Editor only shows the result.
const Panel: FC = () => (
  <WixDesignSystemProvider>
    <SidePanel width="300" height="100vh">
      <SidePanel.Content noPadding stretchVertically>
        <SidePanel.Field>
          <SectionHelper appearance="standard">
            To change the layout, reviews, colours and what is shown, open <b>Google Reviews Carousel</b> in your site dashboard (Apps).
          </SectionHelper>
        </SidePanel.Field>
        <SidePanel.Field>
          <Text size="small" secondary>
            Changes you save there show here after you reload the Editor, and on your site once it is published.
          </Text>
        </SidePanel.Field>
      </SidePanel.Content>
    </SidePanel>
  </WixDesignSystemProvider>
);

export default Panel;
