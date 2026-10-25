import type { FC } from 'react';
import { Box, Button, SectionHelper, SidePanel, Text, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';

// All customisation lives in the app's dashboard page, with a live preview. The Editor only shows the result.
// Wix has no documented way to open one app's dashboard page from an Editor panel, so the button opens the site dashboard
// and the steps say where to go from there.
const DASHBOARD_HOME = 'https://manage.wix.com/account/sites';

const Panel: FC = () => (
  <WixDesignSystemProvider>
    <SidePanel width="300" height="100vh">
      <SidePanel.Content noPadding stretchVertically>
        <SidePanel.Field>
          <SectionHelper appearance="standard">
            Change the layout, reviews, colors and what is shown in your site dashboard, with a live preview.
          </SectionHelper>
        </SidePanel.Field>
        <SidePanel.Field>
          <Box direction="vertical" gap="12px">
            <Button size="small" onClick={() => window.open(DASHBOARD_HOME, '_blank', 'noopener,noreferrer')}>
              Open my site dashboard
            </Button>
            <Text size="small" secondary>
              Then choose your site, open <b>Apps</b> and click <b>Google Reviews Carousel</b>.
            </Text>
            <Text size="small" secondary>
              Changes you save there show here after you reload the Editor, and on your site once it is published.
            </Text>
          </Box>
        </SidePanel.Field>
      </SidePanel.Content>
    </SidePanel>
  </WixDesignSystemProvider>
);

export default Panel;
